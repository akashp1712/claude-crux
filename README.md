<div align="center">
  <h1>🧠 Crux for Claude Code</h1>
  <p><strong>Claude forgets <em>why</em>. Crux doesn't.</strong></p>

  [![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet)](https://docs.anthropic.com/en/docs/claude-code)
  [![Node](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)]()

  <p>Every memory tool remembers <b>what</b>. Only Crux remembers <b>why</b>.</p>
</div>

---

## 🛑 The Context Compaction Problem

You tell Claude: *"Use REST not GraphQL — our team only knows REST."*

Forty turns later, Claude suggests GraphQL.

**It remembered the decision. It forgot the reason. It ignored the constraint.**

Every other memory tool — `CLAUDE.md`, `claude-mem`, Cursor memory — stores flat facts. "Use REST."  
Claude sees "Use REST" and thinks: *that's a suggestion I can override if something better comes along.* And it does. Because nothing tells it **why REST is non-negotiable**.

---

## ⚡ How Crux Solves It (The Causal Graph)

Crux stores decisions as **causal triples**:

```text
  CONSTRAINT   ⛔  Team only knows REST — GraphQL is not an option
       ↓
  RATIONALE    💡  REST is the only viable choice given team skills
       ↓
  DECISION     ▸   Use REST not GraphQL

  ↑ These three are welded together.
    Compaction cannot drop one without dropping all.
    Claude sees the WHY every single time.
```

This is the **co-inclusion guarantee**. The reason travels with the decision. Always.

---

## 🚀 Quick Install

Crux runs as a native plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).  
No `npm install`. No config files. Works immediately.

```bash
# 1. Add the marketplace
/plugin marketplace add akashp1712/claude-marketplace

# 2. Install the plugin
/plugin install crux@akashp1712
```
*(Requires Node.js 18+ and Claude Code)*

---

## ✨ Features at a Glance

- **Causal Memory Graph:** Decisions are linked to their rationales and constraints.
- **Auto-Extraction:** Automatically understands decisions from normal conversation (no manual commands required).
- **Compaction Immunity:** Automatically injects co-inclusion rules right before Claude compacts context.
- **Session-Scoped:** Decisions don't permanently leak. Start a new session, get a clean slate. Promote to permanent `CLAUDE.md` only when you want.
- **Smart Deduplication:** Rephrase the same decision, Crux recognizes the semantic similarity and keeps the graph clean.
- **Multi-Mode Extraction (`CRUX_EXTRACTION_MODE`):**
  - `hybrid` (default): Fast local extraction, falls back to API when unsure (~$0.02/session).
  - `local`: 100% offline, zero-cost, regex-based engine.
  - `api`: Maximum accuracy via Anthropic's API.

---

## 🎯 Examples in Action

See how Crux captures architectural decisions from natural conversation:

### Example 1: API Security & Privacy

**Your Prompt:**
> "We will enhance the API performance while ensuring we never expose user's personal data unless absolutely required for functionality."

**Crux Automatically Extracts:**
```json
{
  "version": "1.0",
  "atoms": {
    "constraint_1772028358486_ao2": {
      "id": "constraint_1772028358486_ao2",
      "type": "CONSTRAINT",
      "content": "Never expose user's personal data unless absolutely required for functionality",
      "dependsOn": [],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:05:58.486Z"
    },
    "goal_1772028358487_zjs": {
      "id": "goal_1772028358487_zjs",
      "type": "GOAL",
      "content": "Enhance API performance",
      "dependsOn": [],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:05:58.487Z"
    },
    "rationale_1772028358487_tya": {
      "id": "rationale_1772028358487_tya",
      "type": "RATIONALE",
      "content": "Data exposure must be minimized to protect user privacy and maintain security compliance",
      "dependsOn": [
        "constraint_1772028358486_ao2"
      ],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:05:58.487Z"
    }
  },
  "turnCount": 1,
  "lastUpdated": "2026-02-25T14:05:58.488Z"
}
```

### Example 2: Technology Stack Decision

**Your Prompt:**
> "Let's implement the authentication system using JWT tokens because our mobile team already has the libraries integrated, and we can't use OAuth due to budget constraints for third-party services."

**Crux Graph Result:**
```json
{
  "version": "1.0",
  "atoms": {
    "decision_1772029123456_xyz": {
      "id": "decision_1772029123456_xyz",
      "type": "DECISION",
      "content": "Implement authentication using JWT tokens",
      "dependsOn": ["rationale_1772029123457_abc"],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:12:34.567Z"
    },
    "rationale_1772029123457_abc": {
      "id": "rationale_1772029123457_abc",
      "type": "RATIONALE",
      "content": "Mobile team already has JWT libraries integrated, ensuring faster development",
      "dependsOn": ["constraint_1772029123458_def"],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:12:34.568Z"
    },
    "constraint_1772029123458_def": {
      "id": "constraint_1772029123458_def",
      "type": "CONSTRAINT",
      "content": "Budget constraints prevent using third-party OAuth services",
      "dependsOn": [],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:12:34.569Z"
    }
  },
  "turnCount": 1,
  "lastUpdated": "2026-02-25T14:12:34.570Z"
}
```

### Example 3: Multi-Turn Decision Evolution

**Turn 1 - Your Prompt:**
> "We need to choose between React and Vue for our frontend. Our team has more React experience."

**Turn 2 - Claude's Response Suggests Vue:**
> "Vue might be better for this use case because..."

**Turn 3 - Your Correction:**
> "I understand Vue's advantages, but we must stick with React because our company standardized on it last year, and we don't have budget for retraining."

**Final Crux Graph:**
```json
{
  "version": "1.0",
  "atoms": {
    "decision_1772029999999_react": {
      "id": "decision_1772029999999_react",
      "type": "DECISION",
      "content": "Use React for frontend development",
      "dependsOn": ["rationale_1772029999999_team", "rationale_1772029999999_company"],
      "status": "ACTIVE",
      "source": "user",
      "turn": 3,
      "createdAt": "2026-02-25T14:30:00.000Z"
    },
    "rationale_1772029999999_team": {
      "id": "rationale_1772029999999_team",
      "type": "RATIONALE",
      "content": "Development team has extensive React experience",
      "dependsOn": [],
      "status": "ACTIVE",
      "source": "user",
      "turn": 1,
      "createdAt": "2026-02-25T14:30:00.001Z"
    },
    "rationale_1772029999999_company": {
      "id": "rationale_1772029999999_company",
      "type": "RATIONALE",
      "content": "Company standardized on React last year",
      "dependsOn": ["constraint_1772029999999_budget"],
      "status": "ACTIVE",
      "source": "user",
      "turn": 3,
      "createdAt": "2026-02-25T14:30:00.002Z"
    },
    "constraint_1772029999999_budget": {
      "id": "constraint_1772029999999_budget",
      "type": "CONSTRAINT",
      "content": "No budget available for team retraining on Vue",
      "dependsOn": [],
      "status": "ACTIVE",
      "source": "user",
      "turn": 3,
      "createdAt": "2026-02-25T14:30:00.003Z"
    }
  },
  "turnCount": 3,
  "lastUpdated": "2026-02-25T14:30:00.004Z"
}
```

---

## 🛠 Commands

| Command | Description |
|---|---|
| `/crux:status` | Inspect the current session's active decision graph. |
| `/crux:export` | Persist active session decisions to your permanent `CLAUDE.md`. |
| `use crux-query` | Ask Claude mid-conversation to check active constraints. |

---

## 🆚 Why Flat Memory Fails

| Memory Engine | Stores the WHY? | Survives Compaction? | Co-Inclusion Guarantee? |
|---|---|---|---|
| **Crux** | **Yes** (Causal Triples) | **Yes** (PreCompact re-injection) | **Yes** |
| `CLAUDE.md` | No (Flat text) | Partial (Can be summarized out) | No |
| `claude-mem` | No (Flat facts) | No | No |
| Cursor Memory | No | No | No |

---

## ⚙️ How it Works (Under the Hood)

Crux hooks directly into Claude Code's lifecycle:

![Crux Architecture Sequence](claude-crux-sequence.png)

1. **`SessionStart`**: Sets up the graph.
2. **`UserPromptSubmit`**: Extracts decisions from your requests.
3. **`PreCompact`**: The magic layer—injects instructions forbidding Claude from separating a DECISION from its RATIONALE/CONSTRAINT.
4. **`Stop`**: Extracts decisions made by Claude's responses.
5. **`SessionEnd`**: Cleans up.

---

## 🔮 Roadmap

### v0.2 — Conflict Detection
When you say "Use PostgreSQL" and later say "Use MongoDB", Crux will flag it: *"This contradicts your earlier decision."* Plus manual commands (`/crux:add`, `/crux:supersede`).

### v0.3 — Expanded Graph & Teams
12 atom types (GOAL, PROBLEM, SOLUTION, etc.). Git-committable graph for team-shared decisions. Per-directory scoping for monorepos.

### v1.0 — The Proxy
`crux-proxy` binary intercepts Anthropic API traffic directly. Token-exact compaction control. No hooks needed — 100% protocol-level co-inclusion guarantee.

---

## 🤝 Troubleshooting & Config

| Variable | Default | Description |
|----------|---------|-------------|
| `CRUX_EXTRACTION_MODE` | `hybrid` | `local` / `api` / `hybrid` |
| `ANTHROPIC_API_KEY` | — | Required only if using `api` or `hybrid` mode. |

**No decisions extracting?** Ensure `CRUX_EXTRACTION_MODE` is set, or check your API key if using full extraction.  
**Decisions gone?** Crux is session-scoped. Run `/crux:export` before quitting to save to `CLAUDE.md`.  
**Not firing?** Run `claude --plugin-dir ./crux`, hit `Ctrl+o` for verbose logs.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/akashp1712">Akash Panchal</a></p>
  <p>Licensed under <b>MIT</b></p>
</div>
