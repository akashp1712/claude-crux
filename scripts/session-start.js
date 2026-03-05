#!/usr/bin/env node
'use strict';

const path = require('path');

const LIB = path.join(__dirname, '..', 'lib');
const { AtomGraph } = require(path.join(LIB, 'graph'));
const storage = require(path.join(LIB, 'storage'));

function main(data) {
  try {
    const sessionId = data.session_id || data.sessionId || 'unknown';
    const cwd = data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const source = data.source || 'startup';

    // Ensure sessions directory exists
    storage.ensureDir(storage.getSessionsDir());

    let graph;

    if (AtomGraph.exists(sessionId)) {
      // Resume or compact — load existing graph
      graph = AtomGraph.load(sessionId);
      if (!graph) {
        graph = new AtomGraph(sessionId, cwd);
        graph.save();
      }
    } else {
      // New session
      graph = new AtomGraph(sessionId, cwd);
      graph.save();
    }

    // Build context summary
    const activeAtoms = graph.getActiveAtoms();
    const decisions = activeAtoms.filter(a => a.type === 'DECISION');
    const constraints = activeAtoms.filter(a => a.type === 'CONSTRAINT');

    let context = `[Crux] Causal graph loaded: ${activeAtoms.length} active atoms, ${decisions.length} decisions tracked.`;

    if (constraints.length > 0) {
      context += '\nActive constraints:';
      constraints.forEach(c => {
        context += `\n  \u26D4 ${c.content}`;
      });
    }

    if (decisions.length > 0) {
      context += '\nActive decisions:';
      decisions.forEach(d => {
        context += `\n  \u25B8 ${d.content}`;
      });
    }

    // Output as additionalContext
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: context
      }
    };

    process.stdout.write(JSON.stringify(output));
  } catch (err) {
    process.stderr.write(`[crux] session-start error: ${err.message}\n`);
    // Graceful degradation — output empty context
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: '[Crux] Causal graph initialized (empty).'
      }
    }));
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
