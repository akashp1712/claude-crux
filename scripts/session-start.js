#!/usr/bin/env node
'use strict'

// ── Crux Graph Helpers (inlined — no imports) ──────────────────────
function getGraphPath() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  return require('path').join(projectDir, '.claude', '.crux', 'graph.json')
}

function loadGraph() {
  const fs = require('fs')
  const p = getGraphPath()
  try {
    if (!fs.existsSync(p)) return emptyGraph()
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch { return emptyGraph() }
}

function saveGraph(graph) {
  const fs = require('fs')
  const path = require('path')
  const p = getGraphPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  graph.lastUpdated = new Date().toISOString()
  fs.writeFileSync(p, JSON.stringify(graph, null, 2))
}

function emptyGraph() {
  return { version: '1.0', atoms: {}, turnCount: 0, lastUpdated: new Date().toISOString() }
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

async function main() {
  try {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    const data = input ? JSON.parse(input) : {}
    const source = data.source || 'startup'

    // Session-scoped: new session starts with a clean graph
    if (source === 'startup') {
      saveGraph(emptyGraph())
      process.stderr.write(`[crux] SessionStart (startup): graph reset for new session\n`)
      process.exit(0)
    }

    // compact / resume: preserve existing graph and inject triples
    const graph = loadGraph()
    const triples = getTriples(graph)

    if (!triples.length) {
      process.exit(0)
    }

    let contextBlock = formatContextBlock(graph)
    if (source === 'compact') {
      contextBlock = '🔄 POST-COMPACTION REINJECTION\n\n' + contextBlock
    }

    const output = {
      hookSpecificOutput: {
        additionalContext: contextBlock
      }
    }

    process.stdout.write(JSON.stringify(output))
    process.stderr.write(`[crux] SessionStart (${source}): ${triples.length} decision(s) injected\n`)
    process.exit(0)
  } catch (err) {
    process.stderr.write(`[crux] SessionStart error: ${err.message}\n`)
    process.exit(0)
  }
}

main()
