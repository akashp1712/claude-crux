---
description: Show the current Crux decision graph — all active decisions, their rationale, and constraints. Use when asked about architectural decisions, tech choices, or project constraints.
---

# Crux Status

Read the current Crux graph from `.claude/.crux/sessions/` in the project root (find the most recent `.json` file, or the one matching the current session).

Display:

1. **Total atoms** broken down by type: CONSTRAINT ⛔, DECISION ▸, RATIONALE 💡, GOAL 🎯, PROBLEM 🔴, SOLUTION ✅, FACT 📌, STAKEHOLDER 👤, ASSUMPTION ❓, CODE_STATE 📁, PREFERENCE 💭, QUESTION ❔
2. **Active decisions** with their full causal chains (trace `dependsOn` links back to root CONSTRAINT/RATIONALE atoms)
3. **Active constraints** — list each one prominently
4. **Session stats**: atoms added, merged, superseded, total turns
5. **Graph health**: number of orphaned decisions (decisions without linked rationale)

Format as a clear, structured summary with emoji prefixes matching each atom type.

If no graph file is found, report that Crux has not tracked any atoms in this session yet.
