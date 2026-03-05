'use strict';

const fs = require('fs');
const path = require('path');

// Storage: per-session, in-project at .claude/.crux/sessions/<session_id>.json

function getProjectDir() {
    return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function getDataDir() {
    if (process.env.CRUX_DATA_DIR) return process.env.CRUX_DATA_DIR;
    return path.join(getProjectDir(), '.claude', '.crux');
}

function getSessionsDir() {
    return path.join(getDataDir(), 'sessions');
}

function getSessionPath(sessionId) {
    // Sanitize sessionId to prevent path traversal
    const safe = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(getSessionsDir(), `${safe}.json`);
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function readJSON(filePath) {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        if (err.code === 'ENOENT') return null;
        process.stderr.write(`[crux] Failed to read ${filePath}: ${err.message}\n`);
        return null;
    }
}

function writeJSON(filePath, data) {
    ensureDir(path.dirname(filePath));
    const json = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, json, 'utf8');
}

function appendJSONL(filePath, record) {
    ensureDir(path.dirname(filePath));
    const line = JSON.stringify(record) + '\n';
    fs.appendFileSync(filePath, line, 'utf8');
}

function sessionExists(sessionId) {
    return fs.existsSync(getSessionPath(sessionId));
}

function getMostRecentSession() {
    const dir = getSessionsDir();
    if (!fs.existsSync(dir)) return null;

    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => ({
            name: f,
            path: path.join(dir, f),
            mtime: fs.statSync(path.join(dir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) return null;
    return readJSON(files[0].path);
}

module.exports = {
    getDataDir,
    getSessionsDir,
    getSessionPath,
    ensureDir,
    readJSON,
    writeJSON,
    appendJSONL,
    sessionExists,
    getMostRecentSession
};
