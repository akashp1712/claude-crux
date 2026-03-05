---
description: Export current session decisions to CLAUDE.md. Use when the user wants to persist architectural decisions beyond the current session.
---

# Crux Export

Read the current Crux graph from `.claude/.crux/sessions/` in the project root (find the most recent `.json` file, or the one matching the current session).

For each active DECISION atom, append to `CLAUDE.md` in the project root under a `## Architectural Decisions (Crux)` section. Include the full causal chain:
- The DECISION content
- Any linked RATIONALE (follow `dependsOn` links)
- Any linked CONSTRAINT (follow `dependsOn` links)
- Any linked GOAL or PROBLEM atoms

Format each as:

- **[decision content]** — [rationale content]. ⛔ [constraint content if exists]

Also export any active GOAL atoms in a separate `## Project Goals (Crux)` section.

If `CLAUDE.md` already has these sections, append new items below existing ones. Do not duplicate items already present.

If the graph has no active decisions, inform the user: "No active decisions to export. Crux captures decisions automatically during the session."

After appending, confirm what was exported: "Exported N decision(s) to CLAUDE.md."
