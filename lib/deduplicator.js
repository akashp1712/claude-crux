'use strict';

const SIMILARITY_THRESHOLD = parseFloat(process.env.CRUX_SIMILARITY_THRESHOLD || '0.7');

function jaccardSimilarity(a, b) {
    const setA = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
    const setB = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
    if (setA.size === 0 && setB.size === 0) return 0;

    const intersection = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

function isDuplicate(existingAtoms, newAtom, threshold) {
    threshold = threshold ?? SIMILARITY_THRESHOLD;

    for (const existing of Object.values(existingAtoms)) {
        if (existing.type !== newAtom.type) continue;
        if (existing.status !== 'ACTIVE') continue;

        const similarity = jaccardSimilarity(existing.content, newAtom.content);
        if (similarity >= threshold) {
            return { isDuplicate: true, existingId: existing.id, similarity };
        }
    }
    return { isDuplicate: false };
}

function deduplicateAtoms(graph, newAtoms) {
    const toAdd = [];
    const toMerge = [];

    for (const atom of newAtoms) {
        const result = isDuplicate(graph.atoms, atom);
        if (result.isDuplicate) {
            toMerge.push({ existingId: result.existingId, newAtom: atom });
        } else {
            toAdd.push(atom);
        }
    }

    return { toAdd, toMerge };
}

module.exports = { isDuplicate, jaccardSimilarity, deduplicateAtoms };
