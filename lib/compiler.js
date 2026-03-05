'use strict';

const { ATOM_TYPES } = require('./types');

function findLinkedRationale(graph, decision, selectedAtoms) {
    const selectedSet = new Set(selectedAtoms.map(a => a.id));
    for (const depId of decision.dependsOn || []) {
        const dep = graph.getAtom(depId);
        if (dep && dep.type === 'RATIONALE' && selectedSet.has(dep.id)) {
            return dep;
        }
    }
    // Also check ancestors
    const ancestors = graph.getAncestors(decision.id);
    for (const id of ancestors) {
        const atom = graph.getAtom(id);
        if (atom && atom.type === 'RATIONALE' && selectedSet.has(atom.id)) {
            return atom;
        }
    }
    return null;
}

function buildCausalChains(graph, decisions, selectedAtoms) {
    const selectedSet = new Set(selectedAtoms.map(a => a.id));
    const chains = [];

    for (const decision of decisions) {
        const ancestors = graph.getAncestors(decision.id);
        const chainAtoms = [...ancestors]
            .map(id => graph.getAtom(id))
            .filter(a => a && selectedSet.has(a.id));

        const typeOrder = { CONSTRAINT: 0, RATIONALE: 1, DECISION: 2 };
        chainAtoms.sort((a, b) => (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3));
        chainAtoms.push(decision);

        if (chainAtoms.length > 1) {
            chains.push(chainAtoms);
        }
    }

    return chains;
}

function compileContext(graph, selectedIds) {
    const atoms = [...selectedIds].map(id => graph.getAtom(id)).filter(Boolean);
    if (atoms.length === 0) return '';

    const constraints = atoms.filter(a => a.type === 'CONSTRAINT');
    const decisions = atoms.filter(a => a.type === 'DECISION');
    const others = atoms.filter(a =>
        !['CONSTRAINT', 'DECISION', 'RATIONALE'].includes(a.type)
    );

    const totalAtoms = Object.keys(graph.atoms).length;
    let output = `[Crux Context \u2014 ${atoms.length} atoms selected, ${totalAtoms} total]\n\n`;

    if (constraints.length > 0) {
        output += '\u26D4 CONSTRAINTS (non-negotiable):\n';
        constraints.forEach(c => { output += `- ${c.content}\n`; });
        output += '\n';
    }

    if (decisions.length > 0) {
        output += '\u25B8 ACTIVE DECISIONS:\n';
        decisions.forEach(d => {
            const rationale = findLinkedRationale(graph, d, atoms);
            if (rationale) {
                output += `- ${d.content} (because: ${rationale.content})\n`;
            } else {
                output += `- ${d.content}\n`;
            }
        });
        output += '\n';
    }

    if (others.length > 0) {
        output += '\uD83D\uDCCB CONTEXT:\n';
        others.forEach(a => {
            const typeInfo = ATOM_TYPES[a.type];
            output += `- ${typeInfo?.emoji || '\u2022'} [${a.type}] ${a.content}\n`;
        });
        output += '\n';
    }

    // Causal chains
    const chains = buildCausalChains(graph, decisions, atoms);
    if (chains.length > 0) {
        output += '\uD83D\uDD17 CAUSAL CHAINS (do not separate):\n';
        chains.forEach(chain => {
            output += `  ${chain.map(a => `${a.type}: ${a.content}`).join(' \u2192 ')}\n`;
        });
    }

    return output.trim();
}

function compileCoInclusionInstructions(graph) {
    const chains = graph.getAllDecisionChains();
    if (chains.length === 0) return '';

    let output = '[CRUX CO-INCLUSION \u2014 DO NOT SEPARATE THESE GROUPS]\n\n';

    chains.forEach((chain, idx) => {
        const decision = chain.find(a => a.type === 'DECISION');
        if (!decision) return;

        output += `Group ${idx + 1}: "${decision.content}"\n`;
        chain.forEach(a => {
            const typeInfo = ATOM_TYPES[a.type];
            output += `  - ${typeInfo?.emoji || '\u2022'} ${a.type}: ${a.content}\n`;
        });
        output += '  >> These MUST appear together. Dropping any one orphans the others.\n\n';
    });

    return output.trim();
}

module.exports = { compileContext, compileCoInclusionInstructions, buildCausalChains };
