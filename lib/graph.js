'use strict';

const { ATOM_TYPES, ATOM_STATUS, estimateTokens } = require('./types');
const storage = require('./storage');
const { computePageRank } = require('./pagerank');

class AtomGraph {
    constructor(sessionId, projectDir) {
        this.version = '1.0';
        this.sessionId = sessionId;
        this.projectDir = projectDir || '';
        this.atoms = {};
        this.turnCount = 0;
        this.stats = { atomsAdded: 0, atomsMerged: 0, atomsSuperseded: 0 };
        this.lastUpdated = new Date().toISOString();
        this._pageRankCache = null;
    }

    addAtom(atom) {
        if (!atom.id || !atom.type || !atom.content) {
            process.stderr.write('[crux] Invalid atom — missing id, type, or content\n');
            return null;
        }
        atom.status = atom.status || ATOM_STATUS.ACTIVE;
        atom.dependsOn = atom.dependsOn || [];
        atom.tokenEstimate = atom.tokenEstimate || estimateTokens(atom.content);
        atom.createdAt = atom.createdAt || new Date().toISOString();
        atom.turn = atom.turn != null ? atom.turn : this.turnCount;

        this.atoms[atom.id] = atom;
        this.stats.atomsAdded++;
        this._pageRankCache = null; // invalidate
        this.lastUpdated = new Date().toISOString();
        return atom;
    }

    getAtom(id) {
        return this.atoms[id] || null;
    }

    getAtomsByType(type) {
        return Object.values(this.atoms).filter(a => a.type === type);
    }

    getActiveAtoms() {
        return Object.values(this.atoms).filter(a => a.status === ATOM_STATUS.ACTIVE);
    }

    getAncestors(atomId) {
        const visited = new Set();
        const queue = [...(this.atoms[atomId]?.dependsOn || [])];

        while (queue.length > 0) {
            const id = queue.shift();
            if (visited.has(id) || !this.atoms[id]) continue;
            visited.add(id);
            queue.push(...(this.atoms[id].dependsOn || []));
        }

        return visited;
    }

    getAllDecisionChains() {
        const decisions = this.getAtomsByType('DECISION')
            .filter(d => d.status === ATOM_STATUS.ACTIVE);

        return decisions.map(decision => {
            const chain = [decision];
            const ancestors = this.getAncestors(decision.id);
            for (const id of ancestors) {
                const atom = this.atoms[id];
                if (atom && atom.status === ATOM_STATUS.ACTIVE) {
                    chain.push(atom);
                }
            }
            // Sort: CONSTRAINT first, then RATIONALE, then DECISION, then others
            const typeOrder = { CONSTRAINT: 0, RATIONALE: 1, DECISION: 2 };
            chain.sort((a, b) => (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3));
            return chain;
        });
    }

    mergeAtom(existingId, newAtom) {
        const existing = this.atoms[existingId];
        if (!existing) return;

        // Keep higher confidence
        if (newAtom.confidence > existing.confidence) {
            existing.confidence = newAtom.confidence;
        }

        // Union dependsOn
        const deps = new Set([...existing.dependsOn, ...(newAtom.dependsOn || [])]);
        existing.dependsOn = [...deps];

        // Update turn to most recent
        if (newAtom.turn != null) {
            existing.turn = Math.max(existing.turn, newAtom.turn);
        }

        this.stats.atomsMerged++;
        this._pageRankCache = null;
        this.lastUpdated = new Date().toISOString();
    }

    supersede(oldId, newId) {
        const old = this.atoms[oldId];
        if (old) {
            old.status = ATOM_STATUS.SUPERSEDED;
            old.supersededBy = newId;
            this.stats.atomsSuperseded++;
            this._pageRankCache = null;
            this.lastUpdated = new Date().toISOString();
        }
    }

    computeImportance() {
        if (!this._pageRankCache) {
            this._pageRankCache = computePageRank(this.atoms);
        }
        return this._pageRankCache;
    }

    getImportanceScore(atomId) {
        const ranks = this.computeImportance();
        if (ranks[atomId] != null) return ranks[atomId];
        const atom = this.atoms[atomId];
        return ATOM_TYPES[atom?.type]?.importance || 0.5;
    }

    incrementTurn() {
        this.turnCount++;
    }

    toJSON() {
        return {
            version: this.version,
            sessionId: this.sessionId,
            projectDir: this.projectDir,
            atoms: this.atoms,
            turnCount: this.turnCount,
            stats: this.stats,
            lastUpdated: this.lastUpdated
        };
    }

    save() {
        const filePath = storage.getSessionPath(this.sessionId);
        storage.writeJSON(filePath, this.toJSON());
    }

    static load(sessionId) {
        const filePath = storage.getSessionPath(sessionId);
        const data = storage.readJSON(filePath);
        if (!data) return null;

        const graph = new AtomGraph(data.sessionId, data.projectDir);
        graph.version = data.version || '1.0';
        graph.atoms = data.atoms || {};
        graph.turnCount = data.turnCount || 0;
        graph.stats = data.stats || { atomsAdded: 0, atomsMerged: 0, atomsSuperseded: 0 };
        graph.lastUpdated = data.lastUpdated || new Date().toISOString();
        return graph;
    }

    static exists(sessionId) {
        return storage.sessionExists(sessionId);
    }
}

module.exports = { AtomGraph };
