'use strict';

const ATOM_TYPES = {
    CONSTRAINT: { importance: 1.0, emoji: '\u26D4', prefix: 'c', description: 'Hard requirement or limitation' },
    DECISION: { importance: 0.95, emoji: '\u25B8', prefix: 'd', description: 'A choice that was made' },
    RATIONALE: { importance: 0.9, emoji: '\uD83D\uDCA1', prefix: 'r', description: 'Why a decision was made' },
    GOAL: { importance: 0.85, emoji: '\uD83C\uDFAF', prefix: 'g', description: 'What the user wants to achieve' },
    PROBLEM: { importance: 0.8, emoji: '\uD83D\uDD34', prefix: 'p', description: 'An issue or bug encountered' },
    SOLUTION: { importance: 0.7, emoji: '\u2705', prefix: 's', description: 'Resolution to a problem' },
    FACT: { importance: 0.6, emoji: '\uD83D\uDCCC', prefix: 'f', description: 'Objective verifiable information' },
    STAKEHOLDER: { importance: 0.55, emoji: '\uD83D\uDC64', prefix: 'sh', description: 'Input attributed to a specific person' },
    ASSUMPTION: { importance: 0.5, emoji: '\u2753', prefix: 'a', description: 'Unconfirmed assumption' },
    CODE_STATE: { importance: 0.4, emoji: '\uD83D\uDCC1', prefix: 'cs', description: 'Codebase state' },
    PREFERENCE: { importance: 0.3, emoji: '\uD83D\uDCAD', prefix: 'pr', description: 'Soft preference (can be overridden)' },
    QUESTION: { importance: 0.2, emoji: '\u2754', prefix: 'q', description: 'Open question awaiting answer' }
};

const CAUSAL_RELATIONSHIPS = ['because', 'drives', 'requires', 'enables', 'resolves', 'supersedes'];

const ATOM_STATUS = {
    ACTIVE: 'ACTIVE',
    SUPERSEDED: 'SUPERSEDED',
    REVERTED: 'REVERTED'
};

// v0.1 only extracts these three types in local mode
const V01_TYPES = ['CONSTRAINT', 'RATIONALE', 'DECISION'];

function generateAtomId(type) {
    const prefix = ATOM_TYPES[type]?.prefix || 'x';
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 5);
    return `${prefix}_${ts}_${rand}`;
}

function estimateTokens(text) {
    if (!text) return 0;
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
}

module.exports = {
    ATOM_TYPES,
    CAUSAL_RELATIONSHIPS,
    ATOM_STATUS,
    V01_TYPES,
    generateAtomId,
    estimateTokens
};
