'use strict';

const https = require('https');
const { ATOM_TYPES, generateAtomId, estimateTokens, ATOM_STATUS } = require('./types');

// ── Sentence-level extraction (local mode) ──
//
// Strategy: split into sentences first, then classify each sentence.
// This prevents patterns from spanning across sentence boundaries.

const CONSTRAINT_SIGNALS = [
    /\b(?:must|cannot|can't|never|always|don't|do not)\b/i,
    /\bis\s+(?:not an option|non-negotiable|required|mandatory)\b/i,
    /\b(?:we can't|budget doesn't allow|deadline is|limited to|restricted to)\b/i,
    /\b(?:team only knows?|only supports?|only works? with)\b/i,
    /\b(?:a hard requirement|a must|essential|not allowed|forbidden|prohibited)\b/i,
    /\bno\s+(?:way to|option for|possibility of)\b/i,
    /\bnot\s+(?:an option|possible|allowed|permitted|supported)\b/i,
    /\brequirement:\s*(.+)/i,
    /(.+?)\s+is\s+not\s+an\s+option/i,
];

const DECISION_SIGNALS = [
    /\b(?:let's use|we'll go with|I've decided|decided to|going with)\b/i,
    /\buse\s+\w+\s+(?:not|instead of|over|rather than)\b/i,
    /\b(?:chose|choose|picked|picking|selected|selecting)\s+\w+\s+(?:over|instead of)\b/i,
    /\b(?:switch|migrate|move|transition)\s+(?:from\s+\w+\s+)?to\b/i,
    /\bgo(?:ing)?\s+with\b/i,
    /\bstick(?:ing)?\s+with\b/i,
    /\b(?:we should|we will|I'll|I will)\s+(?:use|go with|pick|choose)\b/i,
    /\bdecided\s+(?:on|to use|to go with)\b/i,
    /\balways\s+use\s+(.+)/i,
    /\bprefer\s+(\S+)\s+over\s+(\S+)/i,
    /^use\s+\w+/im,  // Imperative "Use X..." at sentence start
];

const RATIONALE_SIGNALS = [
    /\bbecause\b/i,
    /\bsince\b/i,
    /\bdue to\b/i,
    /\b(?:the )?reason(?:\s+is)?\s*:/i,
    /\bso that\b/i,
    /\bgiven that\b/i,
    /\bconsidering\b/i,
    /\bfor\s+(?:performance|security|reliability|scalability|simplicity|maintainability|compatibility)\b/i,
];

const GOAL_SIGNALS = [
    /\bgoal\s+is\s+(.+)/i,
    /\btrying\s+to\s+(.+)/i,
    /\bneed\s+to\s+build\s+(.+)/i,
    /\bwant\s+to\s+(?:build|create|implement)\s+(.+)/i,
];

const NOISE_WORDS = /^(?:yes|no|ok|okay|sure|thanks|thank you|got it|sounds good|right|exactly)\b/i;

function stripCodeBlocks(text) {
    return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
}

function splitSentences(text) {
    return text
        .split(/(?<=[.!?])\s+|\n+/)
        .map(s => s.trim())
        .filter(s => s.length > 5 && !NOISE_WORDS.test(s));
}

function classifySentence(sentence) {
    const types = [];

    for (const pattern of CONSTRAINT_SIGNALS) {
        if (pattern.test(sentence)) { types.push('CONSTRAINT'); break; }
    }
    for (const pattern of DECISION_SIGNALS) {
        if (pattern.test(sentence)) { types.push('DECISION'); break; }
    }
    for (const pattern of RATIONALE_SIGNALS) {
        if (pattern.test(sentence)) { types.push('RATIONALE'); break; }
    }
    for (const pattern of GOAL_SIGNALS) {
        if (pattern.test(sentence)) { types.push('GOAL'); break; }
    }

    return types;
}

function extractRationaleContent(sentence) {
    const match = sentence.match(/\b(?:because|since|due to|given that|considering)\s+(.+)/i);
    if (match && match[1].length > 10) {
        return match[0];
    }
    return null;
}

function extractLocal(text) {
    if (!text || typeof text !== 'string') return [];

    const scanText = stripCodeBlocks(text.length > 5000 ? text.slice(0, 5000) : text);
    const sentences = splitSentences(scanText);

    const atoms = [];
    const seen = new Set();

    for (const sentence of sentences) {
        const types = classifySentence(sentence);
        if (types.length === 0) continue;

        const hasDecision = types.includes('DECISION');
        const hasRationale = types.includes('RATIONALE');
        const hasConstraint = types.includes('CONSTRAINT');
        const hasGoal = types.includes('GOAL');

        if (hasConstraint) {
            const content = cleanContent(sentence);
            const key = `c:${content.toLowerCase().slice(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                atoms.push(makeAtom('CONSTRAINT', content, 0.9));
            }
        }

        if (hasDecision) {
            let decisionContent = sentence;
            if (hasRationale) {
                const stripped = sentence.replace(/\s*\bbecause\b.+$/i, '').trim();
                if (stripped.length > 10) decisionContent = stripped;
            }
            const content = cleanContent(decisionContent);
            const key = `d:${content.toLowerCase().slice(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                atoms.push(makeAtom('DECISION', content, 0.85));
            }
        }

        if (hasRationale) {
            const rationaleContent = extractRationaleContent(sentence) || sentence;
            const content = cleanContent(rationaleContent);
            const key = `r:${content.toLowerCase().slice(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                atoms.push(makeAtom('RATIONALE', content, 0.8));
            }
        }

        if (hasGoal) {
            const content = cleanContent(sentence);
            const key = `g:${content.toLowerCase().slice(0, 50)}`;
            if (!seen.has(key)) {
                seen.add(key);
                atoms.push(makeAtom('GOAL', content, 0.75));
            }
        }
    }

    // Wire causal edges within this message
    wireCausalEdges(atoms);

    return atoms;
}

function makeAtom(type, content, confidence) {
    const { generateAtomId, estimateTokens, ATOM_STATUS } = require('./types');
    return {
        id: generateAtomId(type),
        type,
        content,
        confidence,
        status: ATOM_STATUS.ACTIVE,
        dependsOn: [],
        tokenEstimate: estimateTokens(content)
    };
}

function cleanContent(raw) {
    return raw
        .replace(/^\s+|\s+$/g, '')
        .replace(/\s+/g, ' ')
        .replace(/^[,;:\-\s]+/, '')
        .replace(/[,;:\-\s]+$/, '')
        .replace(/\.+$/, '')
        .slice(0, 150);
}

function wireCausalEdges(atoms) {
    const constraints = atoms.filter(a => a.type === 'CONSTRAINT');
    const rationales = atoms.filter(a => a.type === 'RATIONALE');
    const decisions = atoms.filter(a => a.type === 'DECISION');

    // CONSTRAINT -> RATIONALE
    if (constraints.length > 0 && rationales.length > 0) {
        for (const r of rationales) {
            for (const c of constraints) {
                if (!r.dependsOn.includes(c.id)) r.dependsOn.push(c.id);
            }
        }
    }

    // RATIONALE -> DECISION
    if (rationales.length > 0 && decisions.length > 0) {
        for (const d of decisions) {
            for (const r of rationales) {
                if (!d.dependsOn.includes(r.id)) d.dependsOn.push(r.id);
            }
        }
    }

    // CONSTRAINT -> DECISION (when no rationale)
    if (constraints.length > 0 && rationales.length === 0 && decisions.length > 0) {
        for (const d of decisions) {
            for (const c of constraints) {
                if (!d.dependsOn.includes(c.id)) d.dependsOn.push(c.id);
            }
        }
    }
}

// ── API extraction (Claude Haiku via Anthropic or Bedrock) ──

const DECOMPOSITION_SYSTEM_PROMPT = `You are a semantic atom extractor for software development conversations.
Extract ALL semantic atoms — the minimal independent units of meaning.

For each atom, respond with a JSON array. Each object must have:
- type: One of CONSTRAINT, DECISION, RATIONALE, GOAL, PROBLEM, SOLUTION,
        FACT, STAKEHOLDER, ASSUMPTION, CODE_STATE, PREFERENCE, QUESTION
- content: The atom's meaning in ONE concise sentence
- confidence: 0.0-1.0 (how certain is this information)
- causal_links: Array of indices into this same array, with relationship type.
  Format: [{ "target_index": 0, "relationship": "because" }]
  Relationships: "because", "drives", "requires", "enables", "resolves"

Rules:
- Extract at sub-message granularity (one message may yield multiple atoms)
- A DECISION should ALWAYS link to a RATIONALE if the reason was stated
- CONSTRAINT atoms are highest priority — never miss a hard requirement
- If someone is attributed ("CEO wants..."), create STAKEHOLDER + the requirement
- Only extract atoms that carry meaningful information. Skip filler.

Respond with ONLY a JSON array. No markdown, no explanation.`;

function callBedrockGateway(text, baseUrl, authToken) {
    return new Promise((resolve) => {
        const url = new URL(baseUrl);
        const modelId = process.env.CRUX_MODEL || 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

        const body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1024,
            system: DECOMPOSITION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: text }]
        });

        const reqPath = `${url.pathname.replace(/\/$/, '')}/model/${encodeURIComponent(modelId)}/invoke`;
        process.stderr.write(`[crux] Bedrock request: ${url.hostname}${reqPath}\n`);

        const req = https.request({
            hostname: url.hostname,
            port: url.port ? Number(url.port) : 443,
            path: reqPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
                'Content-Length': Buffer.byteLength(body)
            }
        }, res => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const responseBody = parsed.body
                        ? JSON.parse(Buffer.from(parsed.body, 'base64').toString())
                        : parsed;
                    const text = responseBody.content?.[0]?.text || '[]';
                    const jsonMatch = text.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        resolve(JSON.parse(jsonMatch[0]));
                    } else {
                        process.stderr.write(`[crux] Bedrock response had no JSON array\n`);
                        resolve([]);
                    }
                } catch (err) {
                    process.stderr.write(`[crux] Bedrock parse error: ${err.message}\n`);
                    resolve([]);
                }
            });
        });

        req.on('error', err => { process.stderr.write(`[crux] Bedrock error: ${err.message}\n`); resolve([]); });
        req.setTimeout(25000, () => { req.destroy(); process.stderr.write('[crux] Bedrock timeout\n'); resolve([]); });
        req.write(body);
        req.end();
    });
}

function callAnthropicDirect(text, apiKey) {
    return new Promise((resolve) => {
        const body = JSON.stringify({
            model: process.env.CRUX_MODEL || 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: DECOMPOSITION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: text }]
        });

        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.error) {
                        process.stderr.write(`[crux] API error: ${response.error.message}\n`);
                        return resolve([]);
                    }
                    const content = response.content?.[0]?.text || '[]';
                    const jsonMatch = content.match(/\[[\s\S]*\]/);
                    resolve(jsonMatch ? JSON.parse(jsonMatch[0]) : []);
                } catch (err) {
                    process.stderr.write(`[crux] Failed to parse API response: ${err.message}\n`);
                    resolve([]);
                }
            });
        });

        req.on('error', err => { process.stderr.write(`[crux] API request failed: ${err.message}\n`); resolve([]); });
        req.setTimeout(25000, () => { req.destroy(); process.stderr.write('[crux] API request timed out\n'); resolve([]); });
        req.write(body);
        req.end();
    });
}

function buildAtomsFromRaw(rawAtoms) {
    const atoms = rawAtoms.map((raw, idx) => ({
        id: generateAtomId(raw.type || 'FACT'),
        type: raw.type || 'FACT',
        content: raw.content || '',
        confidence: raw.confidence || 0.7,
        status: ATOM_STATUS.ACTIVE,
        dependsOn: [],
        tokenEstimate: estimateTokens(raw.content || ''),
        _causalLinks: raw.causal_links || [],
        _sourceIndex: idx
    }));

    // Wire causal links by index
    for (const atom of atoms) {
        if (atom._causalLinks) {
            for (const link of atom._causalLinks) {
                const target = atoms[link.target_index];
                if (target && !atom.dependsOn.includes(target.id)) {
                    atom.dependsOn.push(target.id);
                }
            }
            delete atom._causalLinks;
            delete atom._sourceIndex;
        }
    }

    return atoms;
}

async function extractAPI(text) {
    const bedrockBaseUrl = process.env.ANTHROPIC_BEDROCK_BASE_URL;
    const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let rawAtoms;
    if (bedrockBaseUrl && authToken) {
        rawAtoms = await callBedrockGateway(text, bedrockBaseUrl, authToken);
    } else if (apiKey) {
        rawAtoms = await callAnthropicDirect(text, apiKey);
    } else {
        process.stderr.write('[crux] No API key or Bedrock config — falling back to empty extraction\n');
        return [];
    }

    if (!Array.isArray(rawAtoms)) return [];
    return buildAtomsFromRaw(rawAtoms);
}

async function extractHybrid(text) {
    const localAtoms = extractLocal(text);
    if (localAtoms.length > 0) return localAtoms;

    // Fall back to API if no local matches and message is substantial
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 50) {
        return extractAPI(text);
    }

    return [];
}

// ── Main entry point ──

async function decompose(text, source = 'user') {
    const mode = (process.env.CRUX_EXTRACTION_MODE || 'local').toLowerCase();
    let atoms;

    switch (mode) {
        case 'api':
            atoms = await extractAPI(text);
            break;
        case 'hybrid':
            atoms = await extractHybrid(text);
            break;
        case 'local':
        default:
            atoms = extractLocal(text);
            break;
    }

    // Tag source
    atoms.forEach(a => { a.source = source; });
    return atoms;
}

module.exports = { decompose, extractLocal, extractAPI, extractHybrid };
