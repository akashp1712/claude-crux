#!/usr/bin/env node
'use strict'

const https = require('https')
const path = require('path')
const fs = require('fs')

// ── Crux Graph Helpers (inlined — no imports) ──────────────────────
function getGraphPath() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  return path.join(projectDir, '.claude', '.crux', 'graph.json')
}

function loadGraph() {
  const p = getGraphPath()
  try {
    if (!fs.existsSync(p)) return emptyGraph()
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch { return emptyGraph() }
}

function saveGraph(graph) {
  const p = getGraphPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  graph.lastUpdated = new Date().toISOString()
  fs.writeFileSync(p, JSON.stringify(graph, null, 2))
}

function emptyGraph() {
  return { version: '1.0', atoms: {}, turnCount: 0, lastUpdated: new Date().toISOString() }
}

function addAtom(graph, type, content, dependsOn, source, turn) {
  const id = `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
  graph.atoms[id] = { id, type, content, dependsOn, status: 'ACTIVE', source, turn, createdAt: new Date().toISOString() }
  return graph.atoms[id]
}
// ── End Crux Graph Helpers ──────────────────────────────────────────

// ── Deduplication via Jaccard Word Similarity ───────────────────────
function tokenize(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length >= 3)
}

function jaccardSimilarity(a, b) {
  const setA = new Set(tokenize(a))
  const setB = new Set(tokenize(b))
  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0
  let intersection = 0
  for (const w of setA) { if (setB.has(w)) intersection++ }
  return intersection / (setA.size + setB.size - intersection)
}

function isDuplicate(graph, type, content) {
  const existing = Object.values(graph.atoms).filter(a => a.status === 'ACTIVE' && a.type === type)
  for (const atom of existing) {
    if (jaccardSimilarity(content, atom.content) >= 0.8) return true
  }
  return false
}
// ── End Deduplication ───────────────────────────────────────────────

// ── Local Pattern-Based Extraction ──────────────────────────────────
const PATTERNS = {
  CONSTRAINT: [
    { re: /\bmust\s+(.+)/i, conf: 'high' },
    { re: /\bcan'?t\s+(.+)/i, conf: 'high' },
    { re: /\bcannot\s+(.+)/i, conf: 'high' },
    { re: /\brequirement:\s*(.+)/i, conf: 'high' },
    { re: /(.+?)\s+is\s+not\s+an\s+option/i, conf: 'high' },
    { re: /\bteam\s+(?:only\s+knows|doesn'?t?\s+know|can'?t)\s+(.+)/i, conf: 'high' },
    { re: /\bnever\s+use\s+(.+)/i, conf: 'medium' },
    { re: /\bdon'?t\s+use\s+(.+)/i, conf: 'medium' },
  ],
  RATIONALE: [
    { re: /\bbecause\s+(.+)/i, conf: 'high' },
    { re: /\bsince\s+(.+)/i, conf: 'medium' },
    { re: /\bthe\s+reason\s+is\s+(.+)/i, conf: 'high' },
    { re: /\bso\s+that\s+(.+)/i, conf: 'medium' },
    { re: /\bfor\s+(?:performance|security|reliability|scalability|simplicity|maintainability|compatibility)\b/i, conf: 'high' },
    { re: /\bdue\s+to\s+(.+)/i, conf: 'medium' },
  ],
  DECISION: [
    { re: /\buse\s+(\S+)\s+(?:not|instead\s+of|over|rather\s+than)\s+(\S+)/i, conf: 'high' },
    { re: /\bwe(?:'ll|\s+will)\s+(?:go\s+with|use)\s+(.+)/i, conf: 'high' },
    { re: /\bdecided\s+to\s+(.+)/i, conf: 'high' },
    { re: /\balways\s+use\s+(.+)/i, conf: 'high' },
    { re: /\bprefer\s+(\S+)\s+over\s+(\S+)/i, conf: 'high' },
    { re: /\blet'?s?\s+(?:go\s+with|use)\s+(.+)/i, conf: 'medium' },
    { re: /\bgoing\s+(?:to\s+use|with)\s+(.+)/i, conf: 'medium' },
    { re: /\bswitch(?:ing)?\s+to\s+(.+)/i, conf: 'medium' },
  ],
  GOAL: [
    { re: /\bgoal\s+is\s+(.+)/i, conf: 'medium' },
    { re: /\btrying\s+to\s+(.+)/i, conf: 'medium' },
    { re: /\bneed\s+to\s+build\s+(.+)/i, conf: 'medium' },
    { re: /\bwant\s+to\s+(?:build|create|implement)\s+(.+)/i, conf: 'medium' },
  ]
}

function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
}

function splitSentences(text) {
  return text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 5)
}

function extractLocal(text) {
  const cleaned = stripCodeBlocks(text)
  const sentences = splitSentences(cleaned)
  const found = { CONSTRAINT: [], RATIONALE: [], DECISION: [], GOAL: [] }
  let hasHighConfidence = false

  for (const sentence of sentences) {
    for (const type of ['CONSTRAINT', 'RATIONALE', 'DECISION', 'GOAL']) {
      for (const pattern of PATTERNS[type]) {
        const match = sentence.match(pattern.re)
        if (match) {
          found[type].push({ content: sentence.trim(), confidence: pattern.conf })
          if (pattern.conf === 'high') hasHighConfidence = true
          break
        }
      }
    }
  }

  const hasDecision = found.DECISION.length > 0
  const isHighConfidence = hasHighConfidence && hasDecision

  if (!hasDecision && !found.CONSTRAINT.length && !found.RATIONALE.length && !found.GOAL.length) {
    return { atoms: [], confidence: 'none' }
  }

  const atoms = []
  const constraintIndices = []
  const rationaleIndices = []

  for (const c of found.CONSTRAINT) {
    constraintIndices.push(atoms.length)
    atoms.push({ type: 'CONSTRAINT', content: c.content, dependsOn: [], confidence: c.confidence })
  }
  for (const r of found.RATIONALE) {
    rationaleIndices.push(atoms.length)
    atoms.push({ type: 'RATIONALE', content: r.content, dependsOn: [...constraintIndices], confidence: r.confidence })
  }
  for (const d of found.DECISION) {
    atoms.push({ type: 'DECISION', content: d.content, dependsOn: [...rationaleIndices, ...constraintIndices], confidence: d.confidence })
  }
  for (const g of found.GOAL) {
    atoms.push({ type: 'GOAL', content: g.content, dependsOn: [], confidence: g.confidence })
  }

  return { atoms, confidence: isHighConfidence ? 'high' : 'low' }
}
// ── End Local Extraction ────────────────────────────────────────────

const EXTRACTION_SYSTEM_PROMPT = `Extract architectural decisions from this assistant message.
Return JSON only:
{
  "atoms": [
    { "type": "CONSTRAINT|RATIONALE|DECISION|GOAL|FACT", "content": "...", "dependsOn": [indices], "confidence": "high|medium|low" }
  ]
}
Order: CONSTRAINT first, then RATIONALE (dependsOn constraint index), then DECISION (dependsOn rationale+constraint indices).
Only extract EXPLICIT decisions. Return {"atoms":[]} if none found.`

function callHaiku(text) {
  const bedrockBaseUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (bedrockBaseUrl && authToken) {
    return callBedrockGateway(text, bedrockBaseUrl, authToken)
  } else if (apiKey) {
    return callAnthropicDirect(text, apiKey)
  }
  return Promise.resolve(null)
}

function callBedrockGateway(text, baseUrl, authToken) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl)
    const modelId = process.env.CRUX_MODEL || 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }]
    })

    const reqPath = `${url.pathname.replace(/\/$/, '')}/model/${encodeURIComponent(modelId)}/invoke`

    const req = https.request({
      hostname: url.hostname,
      port: url.port ? Number(url.port) : 443,
      path: reqPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          const responseBody = parsed.body ? JSON.parse(Buffer.from(parsed.body, 'base64').toString()) : parsed
          const text = responseBody.content?.[0]?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            resolve(JSON.parse(jsonMatch[0]))
          } else {
            process.stderr.write(`[crux] Bedrock response had no JSON: ${data.slice(0, 300)}\n`)
            resolve(null)
          }
        } catch (err) {
          process.stderr.write(`[crux] Bedrock parse error: ${err.message} | raw: ${data.slice(0, 300)}\n`)
          resolve(null)
        }
      })
    })

    req.on('error', (err) => { process.stderr.write(`[crux] Bedrock request error: ${err.message}\n`); resolve(null) })
    req.setTimeout(50000, () => { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

function callAnthropicDirect(text, apiKey) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: process.env.CRUX_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }]
    })

    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          const text = parsed.content?.[0]?.text || ''
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            resolve(JSON.parse(jsonMatch[0]))
          } else {
            process.stderr.write(`[crux] Haiku response had no JSON: ${data.slice(0, 200)}\n`)
            resolve(null)
          }
        } catch { resolve(null) }
      })
    })

    req.on('error', (err) => { process.stderr.write(`[crux] Haiku request error: ${err.message}\n`); resolve(null) })
    req.setTimeout(50000, () => { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

// ── Hybrid Extraction ───────────────────────────────────────────────
async function extractAtoms(text) {
  const mode = (process.env.CRUX_EXTRACTION_MODE || 'hybrid').toLowerCase()

  if (mode === 'local') {
    const result = extractLocal(text)
    if (result.atoms.length > 0) {
      process.stderr.write(`[crux] Local extraction: ${result.atoms.length} atom(s), confidence=${result.confidence}\n`)
    }
    return result.atoms.length > 0 ? result : null
  }

  if (mode === 'api') {
    const result = await callHaiku(text)
    return result
  }

  // hybrid (default): local first, fall back to API if low confidence
  const localResult = extractLocal(text)
  if (localResult.atoms.length > 0 && localResult.confidence === 'high') {
    process.stderr.write(`[crux] Local extraction (high confidence): ${localResult.atoms.length} atom(s)\n`)
    return localResult
  }

  const apiResult = await callHaiku(text)
  if (apiResult && apiResult.atoms && apiResult.atoms.length > 0) {
    return apiResult
  }

  if (localResult.atoms.length > 0) {
    process.stderr.write(`[crux] Local extraction (low confidence, API empty): ${localResult.atoms.length} atom(s)\n`)
    return localResult
  }

  return null
}
// ── End Hybrid Extraction ───────────────────────────────────────────

async function main() {
  try {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    const data = input ? JSON.parse(input) : {}

    // CRITICAL: prevent infinite loops
    if (data.stop_hook_active) {
      process.exit(0)
    }

    const transcriptPath = data.transcript_path
    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      process.exit(0)
    }

    // Read last 15 lines of transcript JSONL
    const content = fs.readFileSync(transcriptPath, 'utf8')
    const lines = content.trim().split('\n').slice(-15)
    const assistantMessages = []

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)
        if (entry.role === 'assistant' && entry.content) {
          if (typeof entry.content === 'string') {
            assistantMessages.push(entry.content)
          } else if (Array.isArray(entry.content)) {
            entry.content.forEach(block => {
              if (block.type === 'text' && block.text) {
                assistantMessages.push(block.text)
              }
            })
          }
        }
      } catch { /* skip malformed lines */ }
    }

    if (!assistantMessages.length) {
      process.exit(0)
    }

    const combined = assistantMessages.join('\n\n')
    const extraction = await extractAtoms(combined)

    if (extraction && extraction.atoms && extraction.atoms.length > 0) {
      const graph = loadGraph()
      const idMap = {}
      let added = 0
      extraction.atoms.forEach((atom, idx) => {
        if (isDuplicate(graph, atom.type, atom.content)) {
          process.stderr.write(`[crux] Skipping duplicate ${atom.type}: "${atom.content.slice(0, 60)}..."\n`)
          return
        }
        const depIds = (atom.dependsOn || []).map(i => idMap[i]).filter(Boolean)
        const addedAtom = addAtom(graph, atom.type, atom.content, depIds, 'assistant', graph.turnCount)
        idMap[idx] = addedAtom.id
        added++
      })
      if (added > 0) {
        saveGraph(graph)
        process.stderr.write(`[crux] Stop: extracted ${added} atom(s) from assistant response\n`)
      }
    }

    process.exit(0)
  } catch (err) {
    process.stderr.write(`[crux] Stop error: ${err.message}\n`)
    process.exit(0)
  }
}

main()
