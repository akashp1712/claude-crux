<!-- Crux Cover Image -->
<p align="center">
  <img src="crux-cover.jpg" alt="Crux - Claude Code Plugin" width="800">
</p>

<div align="center">
  <h1>🧠 Crux for Claude Code</h1>
  <p><strong>Claude forgets <em>why</em>. Crux doesn't.</strong></p>

  [![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-blueviolet)](https://docs.anthropic.com/en/docs/claude-code)
  [![Node](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
  [![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)](https://github.com/akashp1712/claude-crux)
  [![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/akashp1712/claude-crux)

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

Crux stores decisions as a **causal dependency graph**:

```text
  CONSTRAINT   ⛔  Team only knows REST — GraphQL is not an option
       ↓
  RATIONALE    💡  REST is the only viable choice given team skills
       ↓
  DECISION     ▸   Use REST not GraphQL

  ↑ These are welded together.
    Compaction cannot drop one without dropping all.
    Claude sees the WHY every single time.
```

This is the **co-inclusion guarantee**. The reason travels with the decision. Always.

The pipeline runs on every prompt:

```
User message
     │
     ▼
┌──────────┐   ┌─────────────┐   ┌──────────┐   ┌─────────┐   ┌────────┐
│ Decompose│──▶│ Deduplicate │──▶│  Select  │──▶│ Compile │──▶│ Verify │
│ (extract │   │ (Jaccard    │──▶│ (budget  │   │ (format │   │(orphan │
│  atoms)  │   │  similarity)│   │ + co-    │   │  block) │   │ check) │
└──────────┘   └─────────────┘   │ include) │   └─────────┘   └────────┘
                                  └──────────┘
                                       │
                                       ▼
                               additionalContext
                               injected alongside
                               the user's prompt
```

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

- **Causal Memory Graph:** 12 atom types linked in a directed acyclic graph. Decisions carry their rationale and constraints.
- **Auto-Extraction:** Understands decisions from natural conversation — no manual tagging.
- **Smart Selection:** Scores atoms by relevance × type weight × PageRank importance × recency. Only the most relevant atoms are injected, respecting a token budget.
- **Co-Inclusion Guarantee:** A decision is never injected without all its ancestor atoms. If the budget can't fit the chain, the whole group is skipped — no orphans.
- **Compaction Immunity:** On `PreCompact`, injects group instructions forbidding Claude from separating a decision from its rationale. On resume, the full graph is reloaded from disk.
- **Session-Scoped Storage:** Each Claude session gets its own graph at `.claude/.crux/sessions/<session_id>.json`. Sessions don't interfere. Promote to permanent `CLAUDE.md` only when you want.
- **Smart Deduplication:** Rephrase the same decision — Crux recognizes semantic similarity (Jaccard) and merges instead of duplicating.
- **Multi-Mode Extraction:**
  - `local` (default): 100% offline, zero-cost, regex-based — extracts CONSTRAINT, RATIONALE, DECISION, GOAL.
  - `api`: Full semantic extraction via Anthropic or **AWS Bedrock**. All 12 atom types.
  - `hybrid`: Local first, falls back to API for substance-dense messages with low local confidence.

---

## 🔬 The 12 Atom Types

| Type | Emoji | Priority | Description |
|------|:-----:|:--------:|-------------|
| CONSTRAINT | ⛔ | 1.00 | Hard requirement — never negotiable |
| DECISION | ▸ | 0.95 | A choice that was made |
| RATIONALE | 💡 | 0.90 | Why a decision was made |
| GOAL | 🎯 | 0.85 | What the user wants to achieve |
| PROBLEM | 🔴 | 0.80 | An issue or bug encountered |
| SOLUTION | ✅ | 0.70 | Resolution to a problem |
| FACT | 📌 | 0.60 | Objective verifiable information |
| STAKEHOLDER | 👤 | 0.55 | Input attributed to a specific person |
| ASSUMPTION | ❓ | 0.50 | Unconfirmed assumption |
| CODE_STATE | 📁 | 0.40 | Codebase state |
| PREFERENCE | 💭 | 0.30 | Soft preference (can be overridden) |
| QUESTION | ❔ | 0.20 | Open question awaiting answer |

> **Local mode** extracts: CONSTRAINT, RATIONALE, DECISION, GOAL.  
> **API/hybrid mode** unlocks all 12 via Claude Haiku.

---

## 🎯 Example in Action

**Your prompts over several turns:**
```
Turn 1: "We must use TypeScript — the team only knows TypeScript. Python is not an option."
Turn 2: "Let's use Express because it has the best middleware ecosystem."
Turn 3: "Actually, let's go with Fastify instead — it's 2x faster."
```

**What Crux injects on the next relevant prompt:**
```
[Crux Context — 5 atoms selected, 7 total]

⛔ CONSTRAINTS (non-negotiable):
- We must use TypeScript — the team only knows TypeScript
- Python is not an option

▸ ACTIVE DECISIONS:
- Let's go with Fastify instead (because: it's 2x faster)

🔗 CAUSAL CHAINS (do not separate):
  CONSTRAINT: Must use TypeScript → RATIONALE: team only knows TypeScript → DECISION: Use Fastify
```

---

## 🛠 Commands

| Command | Description |
|---|---|
| `/crux:status` | Full graph summary — atom counts by type, active decisions with causal chains, session stats, graph health. |
| `/crux:why <query>` | Trace a decision's causal chain back to its root constraints. |
| `/crux:decisions` | List all active decisions (with rationale) and any superseded ones. |
| `/crux:export` | Persist active decisions to your permanent `CLAUDE.md`. |

---

## ⚙️ How it Works (Under the Hood)

Crux hooks directly into Claude Code's lifecycle:

![Crux Architecture Sequence](claude-crux-sequence.png)

```
SESSION START ────────────────────────────────────────────────
  │  Load graph from .claude/.crux/sessions/<session_id>.json
  │  Inject: "[Crux] 5 active atoms, 2 decisions tracked."
  │
  ▼
USER TURN LOOP ──────────────────────────────────────────────
  │
  │  ┌─ UserPromptSubmit ───────────────────────────────────┐
  │  │  1. Output current context (smart-selected)          │
  │  │  2. Extract new atoms from user message              │
  │  │  3. Deduplicate (Jaccard similarity merge)           │
  │  │  4. Save updated graph                               │
  │  └──────────────────────────────────────────────────────┘
  │
  │  ┌─ Stop ───────────────────────────────────────────────┐
  │  │  Extract atoms from Claude's response (silently)     │
  │  └──────────────────────────────────────────────────────┘
  │
  ▼
PRE-COMPACT ─────────────────────────────────────────────────
  │  Inject co-inclusion groups: "DO NOT SEPARATE THESE"
  │
  ▼
SESSION END ─────────────────────────────────────────────────
     Log stats. Graph preserved for /crux:status and export.
```

---

## 🆚 Why Flat Memory Fails

| Memory Engine | Stores the WHY? | Survives Compaction? | Co-Inclusion Guarantee? | Smart Selection? |
|---|---|---|---|---|
| **Crux** | **Yes** (Causal Graph) | **Yes** (disk + PreCompact) | **Yes** | **Yes** (PageRank + relevance) |
| `CLAUDE.md` | No (Flat text) | Partial (summarized out) | No | No |
| `claude-mem` | No (Flat facts) | No | No | No |
| Cursor Memory | No | No | No | No |

---

## 🤝 Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CRUX_EXTRACTION_MODE` | `local` | `local` / `api` / `hybrid` |
| `CRUX_TOKEN_BUDGET` | `2000` | Max tokens injected per prompt |
| `CRUX_SIMILARITY_THRESHOLD` | `0.7` | Dedup threshold (0.0–1.0) |
| `CRUX_DATA_DIR` | `.claude/.crux` | Override storage location |
| `CRUX_MODEL` | `claude-haiku-4-5-20251001` | Model for API/hybrid extraction |
| `ANTHROPIC_API_KEY` | — | Required for `api` / `hybrid` mode |
| `ANTHROPIC_BEDROCK_BASE_URL` | — | AWS Bedrock gateway URL |
| `ANTHROPIC_AUTH_TOKEN` | — | AWS Bedrock auth token |

### Storage

Each session's graph is stored in-project:
```
.claude/.crux/sessions/
└── <session_id>.json    ← one graph per Claude session
```
Sessions are isolated — a new session always starts clean. Use `/crux:export` to promote decisions to `CLAUDE.md` permanently.

**Troubleshooting:**  
- **No decisions extracting?** Check `CRUX_EXTRACTION_MODE`. In `api`/`hybrid`, verify `ANTHROPIC_API_KEY`.  
- **Decisions gone after compact?** They shouldn't be — graph is on disk. Run `/crux:status` to verify reload.  
- **Not firing?** Run `claude --plugin-dir ./crux` and press `Ctrl+o` for verbose hook logs.

---

## 🔮 Roadmap

### v0.3 — Conflict Detection
When you say "Use PostgreSQL" and later say "Use MongoDB" in the same session, Crux will flag it: *"This contradicts your earlier decision."* Plus manual commands (`/crux:add`, `/crux:supersede`).

### v1.0 — The Proxy
`crux-proxy` binary intercepts Anthropic API traffic directly. Token-exact compaction control. No hooks needed — 100% protocol-level co-inclusion guarantee.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/akashp1712">Akash Panchal</a></p>
  <p>Licensed under <b>MIT</b></p>
</div>
