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

function formatCompactionInstructions(graph) {
  const triples = getTriples(graph)
  if (!triples.length) return 'No architectural decisions to preserve.'
  const lines = [
    '=== CRUX: CRITICAL PRESERVATION INSTRUCTIONS ===',
    '',
    'The following architectural decisions MUST be preserved VERBATIM.',
    'Never summarize, paraphrase, or drop them. They are load-bearing.',
    ''
  ]
  triples.forEach(t => {
    lines.push(`[DECISION]   ${t.decision.content}`)
    lines.push(`[RATIONALE]  ${t.rationale.content}`)
    if (t.constraint) lines.push(`[CONSTRAINT] ⛔ ${t.constraint.content}`)
    lines.push('')
  })
  lines.push('After compaction, ALL of the above must appear in the summary.')
  lines.push('=== END CRUX INSTRUCTIONS ===')
  return lines.join('\n')
}
// ── End Crux Graph Helpers ──────────────────────────────────────────

async function main() {
  try {
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    const data = input ? JSON.parse(input) : {}
    const trigger = data.trigger || data.source || 'auto'

    const graph = loadGraph()
    const triples = getTriples(graph)
    const instructions = formatCompactionInstructions(graph)

    // PreCompact outputs PLAIN TEXT — Claude Code uses it as custom_instructions
    process.stdout.write(instructions)
    process.stderr.write(`[crux] ⚠️ PreCompact (${trigger}): protecting ${triples.length} decision(s)\n`)
    process.exit(0)
  } catch (err) {
    process.stderr.write(`[crux] PreCompact error: ${err.message}\n`)
    process.exit(0)
  }
}

main()
