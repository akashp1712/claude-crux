#!/usr/bin/env node
'use strict';

const path = require('path');

const LIB = path.join(__dirname, '..', 'lib');
const { AtomGraph } = require(path.join(LIB, 'graph'));
const storage = require(path.join(LIB, 'storage'));

function main(data) {
  try {
    const sessionId = data.session_id || data.sessionId || 'unknown';

    const graph = AtomGraph.load(sessionId);
    if (!graph) {
      process.stderr.write('[crux] Session ended (no graph found).\n');
      return;
    }

    const activeAtoms = graph.getActiveAtoms();
    const decisions = activeAtoms.filter(a => a.type === 'DECISION');
    const totalAtoms = Object.keys(graph.atoms).length;

    // Log final stats to stderr
    process.stderr.write(
      `[crux] Session ended. Atoms: ${totalAtoms}, Decisions: ${decisions.length}, ` +
      `Added: ${graph.stats.atomsAdded}, Merged: ${graph.stats.atomsMerged}, ` +
      `Superseded: ${graph.stats.atomsSuperseded}\n`
    );

    // Append to session log for analytics
    const logPath = path.join(storage.getDataDir(), 'session-log.jsonl');
    storage.appendJSONL(logPath, {
      sessionId: graph.sessionId,
      projectDir: graph.projectDir,
      endedAt: new Date().toISOString(),
      reason: data.reason || 'unknown',
      totalAtoms,
      activeAtoms: activeAtoms.length,
      decisions: decisions.length,
      turns: graph.turnCount,
      stats: graph.stats
    });

    // Graph file preserved for --resume and /crux:status

  } catch (err) {
    process.stderr.write(`[crux] session-end error: ${err.message}\n`);
  }
}

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  let data = {};
  try {
    if (input.trim()) data = JSON.parse(input);
  } catch (err) {
    process.stderr.write(`[crux] Failed to parse stdin: ${err.message}\n`);
  }
  main(data);
});
