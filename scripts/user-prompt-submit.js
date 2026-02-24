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

function getActiveDecisions(graph) {
  return Object.values(graph.atoms).filter(a => a.status === 'ACTIVE' && a.type === 'DECISION')
}

function getTriples(graph) {
  const decisions = getActiveDecisions(graph)
  return decisions.map(d => {
    const deps = d.dependsOn.map(id => graph.atoms[id]).filter(Boolean)
    const rationale = deps.find(a => a.type === 'RATIONALE')
    const constraint = deps.find(a => a.type === 'CONSTRAINT')
    return rationale ? { decision: d, rationale, constraint: constraint || null } : null
  }).filter(Boolean)
}

function formatContextBlock(graph) {
  const triples = getTriples(graph)
  if (!triples.length) return ''
  const lines = [
    '--- CRUX: Active Architectural Decisions ---',
    '⚠️  Check these before recommending any technology or architecture.',
    ''
  ]
  triples.forEach(t => {
    lines.push(`▸ [DECISION]   ${t.decision.content}`)
    lines.push(`  [RATIONALE]  ${t.rationale.content}`)
    if (t.constraint) lines.push(`  [CONSTRAINT] ⛔ ${t.constraint.content}`)
    lines.push('')
  })
  lines.push('--- END CRUX ---')
  return lines.join('\n')
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
          break // one match per type per sentence
        }
      }
    }
  }

  // Need at least one DECISION for a high-confidence local extraction
  const hasDecision = found.DECISION.length > 0
  const isHighConfidence = hasHighConfidence && hasDecision

  if (!hasDecision && !found.CONSTRAINT.length && !found.RATIONALE.length && !found.GOAL.length) {
    return { atoms: [], confidence: 'none' }
  }

  // Build atoms in priority order: CONSTRAINT -> RATIONALE -> DECISION -> GOAL
  // Link causally: RATIONALE depends on CONSTRAINTs, DECISION depends on RATIONALE + CONSTRAINTs
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

const EXTRACTION_SYSTEM_PROMPT = `Extract architectural decisions from this developer message.
Return JSON only:
{
  "atoms": [
    { "type": "CONSTRAINT|RATIONALE|DECISION|GOAL|FACT", "content": "...", "dependsOn": [indices], "confidence": "high|medium|low" }
  ]
}
Order: CONSTRAINT first, then RATIONALE (dependsOn constraint index), then DECISION (dependsOn rationale+constraint indices).
Only extract EXPLICIT decisions. Return {"atoms":[]} if none found.`

function callHaiku(userMessage) {
  const bedrockBaseUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (bedrockBaseUrl && authToken) {
    return callBedrockGateway(userMessage, bedrockBaseUrl, authToken)
  } else if (apiKey) {
    return callAnthropicDirect(userMessage, apiKey)
  }
  return Promise.resolve(null)
}

function callBedrockGateway(userMessage, baseUrl, authToken) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl)
    const modelId = process.env.CRUX_MODEL || 'us.anthropic.claude-haiku-4-5-20251001-v1:0'

    // Bedrock InvokeModel: body has anthropic_version, max_tokens, system, messages (no model field)
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })

    const reqPath = `${url.pathname.replace(/\/$/, '')}/model/${encodeURIComponent(modelId)}/invoke`
    process.stderr.write(`[crux] Bedrock request: ${url.hostname}${reqPath}\n`)

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
          // Bedrock may wrap response in a body field, or return directly
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
    req.setTimeout(25000, () => { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

function callAnthropicDirect(userMessage, apiKey) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: process.env.CRUX_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
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
    req.setTimeout(25000, () => { req.destroy(); resolve(null) })
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

  // Fall back to API
  const apiResult = await callHaiku(text)
  if (apiResult && apiResult.atoms && apiResult.atoms.length > 0) {
    return apiResult
  }

  // If API returned nothing but local had low-confidence results, use them
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
    const userMessage = data.prompt || data.message || ''

    const graph = loadGraph()
    graph.turnCount = (graph.turnCount || 0) + 1

    // PHASE 1: Immediately output current context block
    const contextBlock = formatContextBlock(graph)
    if (contextBlock) {
      const output = {
        hookSpecificOutput: {
          additionalContext: contextBlock
        }
      }
      process.stdout.write(JSON.stringify(output))
    }

    // PHASE 2: Extract atoms from user message (local, API, or hybrid)
    if (userMessage) {
      const extraction = await extractAtoms(userMessage)
      if (extraction && extraction.atoms && extraction.atoms.length > 0) {
        const idMap = {}
        let added = 0
        extraction.atoms.forEach((atom, idx) => {
          if (isDuplicate(graph, atom.type, atom.content)) {
            process.stderr.write(`[crux] Skipping duplicate ${atom.type}: "${atom.content.slice(0, 60)}..."\n`)
            return
          }
          const depIds = (atom.dependsOn || []).map(i => idMap[i]).filter(Boolean)
          const addedAtom = addAtom(graph, atom.type, atom.content, depIds, 'user', graph.turnCount)
          idMap[idx] = addedAtom.id
          added++
        })
        if (added > 0) {
          saveGraph(graph)
          process.stderr.write(`[crux] UserPromptSubmit: extracted ${added} atom(s) from user message\n`)
        }
      }
    }

    process.exit(0)
  } catch (err) {
    process.stderr.write(`[crux] UserPromptSubmit error: ${err.message}\n`)
    process.exit(0)
  }
}

main()
