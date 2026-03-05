#!/usr/bin/env node
'use strict';

const path = require('path');

const LIB = path.join(__dirname, '..', 'lib');
const { AtomGraph } = require(path.join(LIB, 'graph'));
const { decompose } = require(path.join(LIB, 'decomposer'));
const { deduplicateAtoms } = require(path.join(LIB, 'deduplicator'));
const { selectAtoms } = require(path.join(LIB, 'selector'));
const { compileContext } = require(path.join(LIB, 'compiler'));
const { verify } = require(path.join(LIB, 'verifier'));

async function main(data) {
  try {
    const sessionId = data.session_id || data.sessionId || 'unknown';
    const prompt = data.prompt || '';

    // PHASE 1: Immediately output current context block (before extracting new atoms)
    let graph = AtomGraph.load(sessionId);
    if (!graph) {
      graph = new AtomGraph(sessionId, data.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
    }

    // Output current graph context first (before processing new atoms)
    const currentActiveIds = selectAtoms(graph, prompt);
    if (currentActiveIds.size > 0) {
      let compiled = compileContext(graph, currentActiveIds);
      const { output: verified } = verify(graph, currentActiveIds, compiled);
      compiled = verified;

      const immediateOutput = {
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: compiled
        }
      };
      process.stdout.write(JSON.stringify(immediateOutput));
    }

    if (!prompt.trim()) return;

    // Increment turn
    graph.incrementTurn();

    // PHASE 2: Extract atoms from user prompt
    const newAtoms = await decompose(prompt, 'user');

    // Tag atoms with current turn
    newAtoms.forEach(a => { a.turn = graph.turnCount; });

    // Deduplicate against existing atoms
    const { toAdd, toMerge } = deduplicateAtoms(graph, newAtoms);

    // Add new atoms
    for (const atom of toAdd) {
      graph.addAtom(atom);
    }

    // Merge duplicates
    for (const { existingId, newAtom } of toMerge) {
      graph.mergeAtom(existingId, newAtom);
    }

    if (toAdd.length > 0 || toMerge.length > 0) {
      process.stderr.write(`[crux] UserPromptSubmit: +${toAdd.length} atoms, ${toMerge.length} merged\n`);
    }

    // Save updated graph
    graph.save();

    // If no current context was output yet, re-run selection with new atoms
    if (currentActiveIds.size === 0 && (toAdd.length > 0 || toMerge.length > 0)) {
      const selectedIds = selectAtoms(graph, prompt);
      if (selectedIds.size > 0) {
        let compiled = compileContext(graph, selectedIds);
        const { output: verified } = verify(graph, selectedIds, compiled);
        compiled = verified;

        const output = {
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: compiled
          }
        };
        // Note: we already wrote stdout above, so just save graph
        // stdout can only be written once; graph is already saved
      }
    }

  } catch (err) {
    process.stderr.write(`[crux] user-prompt-submit error: ${err.message}\n`);
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
  main(data).catch(err => {
    process.stderr.write(`[crux] user-prompt-submit unhandled: ${err.message}\n`);
  });
});
