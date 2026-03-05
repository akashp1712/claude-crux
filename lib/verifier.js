'use strict';

function verify(graph, selectedIds, compiledOutput) {
    const violations = [];
    const decisions = [...selectedIds]
        .map(id => graph.getAtom(id))
        .filter(a => a && a.type === 'DECISION');

    for (const decision of decisions) {
        const ancestors = graph.getAncestors(decision.id);
        const rationaleAncestors = [...ancestors]
            .map(id => graph.getAtom(id))
            .filter(a => a && a.type === 'RATIONALE' && a.status === 'ACTIVE');

        for (const rationale of rationaleAncestors) {
            if (!compiledOutput.includes(rationale.content)) {
                violations.push({
                    decision: decision.content,
                    missingRationale: rationale.content,
                    rationaleId: rationale.id
                });
            }
        }
    }

    let fixedOutput = compiledOutput;
    if (violations.length > 0) {
        fixedOutput += '\n\n[CRUX: RATIONALE RESTORED]\n';
        violations.forEach(v => {
            fixedOutput += `- Decision "${v.decision}" requires: ${v.missingRationale}\n`;
        });
    }

    return { output: fixedOutput, violations };
}

module.exports = { verify };
