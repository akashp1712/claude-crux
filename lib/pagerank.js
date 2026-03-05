'use strict';

function computePageRank(atoms, damping = 0.3, iterations = 20, tolerance = 1e-4) {
    const ids = Object.keys(atoms);
    const N = ids.length;
    if (N === 0) return {};

    let ranks = {};
    ids.forEach(id => { ranks[id] = 1 / N; });

    // Build reverse adjacency: who points TO this atom via dependsOn
    const inbound = {};
    ids.forEach(id => { inbound[id] = []; });
    ids.forEach(id => {
        (atoms[id].dependsOn || []).forEach(depId => {
            if (inbound[depId]) inbound[depId].push(id);
        });
    });

    for (let iter = 0; iter < iterations; iter++) {
        const newRanks = {};
        let maxDelta = 0;

        ids.forEach(id => {
            let sum = 0;
            inbound[id].forEach(srcId => {
                const outDegree = (atoms[srcId].dependsOn || []).length || 1;
                sum += ranks[srcId] / outDegree;
            });
            newRanks[id] = (1 - damping) / N + damping * sum;
            maxDelta = Math.max(maxDelta, Math.abs(newRanks[id] - ranks[id]));
        });

        ranks = newRanks;
        if (maxDelta < tolerance) break;
    }

    return ranks;
}

module.exports = { computePageRank };
