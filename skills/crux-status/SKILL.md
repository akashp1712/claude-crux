---
description: Show the current Crux decision graph — all active decisions, their rationale, and constraints. Use when asked about architectural decisions, tech choices, or project constraints.
---

# Crux Status

Read `.claude/.crux/graph.json` from the project root.

Display all active architectural decisions in this format:

## 🔩 Crux — Active Decisions

For each DECISION+RATIONALE+CONSTRAINT triple:

**Decision:** [decision content]
**Rationale:** [rationale content]
**Constraint:** ⛔ [constraint content] *(if exists)*
**Recorded:** Turn [turn], Source: [user/assistant/manual]

If no decisions exist: "No decisions recorded yet. Crux will capture them automatically as you code."

Show total atom count and turn count as a footer.
