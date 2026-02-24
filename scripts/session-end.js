#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

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
// ── End Crux Graph Helpers ──────────────────────────────────────────

async function main() {
  try {
    const graph = loadGraph()
    const atomCount = Object.keys(graph.atoms).length
    const turnCount = graph.turnCount || 0

    // Session is over — clear the graph
    // Decisions persist only within a session; use /crux:export to save to CLAUDE.md
    saveGraph(emptyGraph())

    process.stderr.write(`[crux] SessionEnd: cleared graph (was ${atomCount} atom(s), turn ${turnCount})\n`)
    process.exit(0)
  } catch (err) {
    process.stderr.write(`[crux] SessionEnd error: ${err.message}\n`)
    process.exit(0)
  }
}

main()
