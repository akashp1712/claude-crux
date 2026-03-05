#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const LIB = path.join(__dirname, '..', 'lib');
const { AtomGraph } = require(path.join(LIB, 'graph'));
const { decompose } = require(path.join(LIB, 'decomposer'));
const { deduplicateAtoms } = require(path.join(LIB, 'deduplicator'));

async function main(data) {
  try {
    const sessionId = data.session_id || data.sessionId || 'unknown';
    const stopHookActive = data.stop_hook_active || false;

    // Prevent infinite loops
    if (stopHookActive) return;

    // Load graph — only extract from assistant if graph exists
    let graph = AtomGraph.load(sessionId);
    if (!graph) return;

    // Try to get assistant message from transcript path (crux approach)
    let assistantMessage = data.last_assistant_message || data.message || '';

    const transcriptPath = data.transcript_path;
    if (!assistantMessage && transcriptPath && fs.existsSync(transcriptPath)) {
      const content = fs.readFileSync(transcriptPath, 'utf8');
      const lines = content.trim().split('\n').slice(-15);
      const assistantMessages = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.role === 'assistant' && entry.content) {
            if (typeof entry.content === 'string') {
              assistantMessages.push(entry.content);
            } else if (Array.isArray(entry.content)) {
              entry.content.forEach(block => {
                if (block.type === 'text' && block.text) {
                  assistantMessages.push(block.text);
                }
              });
            }
          }
        } catch { /* skip malformed lines */ }
      }

      if (assistantMessages.length > 0) {
        assistantMessage = assistantMessages.join('\n\n');
      }
    }

    if (!assistantMessage.trim()) return;

    // Extract atoms from Claude's response
    const newAtoms = await decompose(assistantMessage, 'assistant');

    if (newAtoms.length === 0) return;

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
      process.stderr.write(`[crux] Stop: +${toAdd.length} atoms, ${toMerge.length} merged from assistant\n`);
      graph.save();
    }

    // Exit silently — don't inject context from Stop hook

  } catch (err) {
    process.stderr.write(`[crux] stop error: ${err.message}\n`);
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
    process.stderr.write(`[crux] stop unhandled: ${err.message}\n`);
    process.exit(0);
  });
});
