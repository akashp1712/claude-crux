'use strict';

const { ATOM_TYPES, estimateTokens } = require('./types');

const DEFAULT_TOKEN_BUDGET = parseInt(process.env.CRUX_TOKEN_BUDGET || '2000', 10);

function computeRelevance(atomContent, prompt) {
    if (!prompt || !atomContent) return 0;
    const atomWords = new Set(atomContent.toLowerCase().split(/\s+/).filter(Boolean));
    const promptWords = new Set(prompt.toLowerCase().split(/\s+/).filter(Boolean));
    const intersection = [...atomWords].filter(w => promptWords.has(w)).length;
    const union = new Set([...atomWords, ...promptWords]).size;
    return union === 0 ? 0 : intersection / union;
}

function computeScore(atom, prompt, graph) {
    const typeWeight = ATOM_TYPES[atom.type]?.importance || 0.5;
    const relevance = computeRelevance(atom.content, prompt);
    const recency = 1 / (1 + (graph.turnCount - (atom.turn || 0)) * 0.1);
    const importance = graph.getImportanceScore(atom.id);

    return (relevance * 0.4) + (typeWeight * 0.3) + (importance * 0.2) + (recency * 0.1);
}

function selectAtoms(graph, prompt, tokenBudget) {
    tokenBudget = tokenBudget ?? DEFAULT_TOKEN_BUDGET;

    const activeAtoms = graph.getActiveAtoms();
    if (activeAtoms.length === 0) return new Set();

    // Score each atom
    const scored = activeAtoms.map(atom => ({
        atom,
        score: computeScore(atom, prompt, graph)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Greedy selection with co-inclusion guarantee
    const selected = new Set();
    let remaining = tokenBudget;

    for (const { atom } of scored) {
        if (remaining <= 0) break;
        if (selected.has(atom.id)) continue;

        // Get ALL ancestors (the co-inclusion set)
        const ancestorIds = graph.getAncestors(atom.id);
        const unselectedAncestors = [...ancestorIds].filter(id =>
            !selected.has(id) && graph.getAtom(id)?.status === 'ACTIVE'
        );

        // Total cost = atom + all unselected ancestors
        const atomCost = atom.tokenEstimate || estimateTokens(atom.content);
        const ancestorCost = unselectedAncestors.reduce(
            (sum, id) => sum + (graph.getAtom(id)?.tokenEstimate || 10), 0
        );
        const totalCost = atomCost + ancestorCost;

        if (totalCost <= remaining) {
            selected.add(atom.id);
            unselectedAncestors.forEach(id => selected.add(id)); // FORCED co-inclusion
            remaining -= totalCost;
        }
        // Else skip entirely — no orphans allowed
    }

    return selected;
}

module.exports = { selectAtoms, computeScore, computeRelevance };
