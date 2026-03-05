#!/usr/bin/env node
'use strict';

const path = require('path');

const LIB = path.join(__dirname, '..', 'lib');
const { AtomGraph } = require(path.join(LIB, 'graph'));
const { compileCoInclusionInstructions } = require(path.join(LIB, 'compiler'));

function main(data) {
  try {
    const sessionId = data.session_id || data.sessionId || 'unknown';

    const graph = AtomGraph.load(sessionId);
    if (!graph) {
      // No graph — nothing to protect
      process.stdout.write('');
      return;
    }

    const activeAtoms = graph.getActiveAtoms();
    if (activeAtoms.length === 0) {
      process.stdout.write('');
      return;
    }

    // Build co-inclusion instructions
    const instructions = compileCoInclusionInstructions(graph);

    if (!instructions) {
      process.stdout.write('');
      return;
    }

    // The graph is persisted on disk — even if compaction drops everything,
    // SessionStart with the "compact" matcher will re-inject from the graph.
    // This output is a best-effort injection before compaction happens.
    process.stdout.write(instructions);
  } catch (err) {
    process.stderr.write(`[crux] pre-compact error: ${err.message}\n`);
    process.stdout.write('');
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
