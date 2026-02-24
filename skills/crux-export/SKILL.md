---
description: Export current session decisions to CLAUDE.md. Use when the user wants to persist architectural decisions beyond the current session.
---

# Crux Export

Read `.claude/.crux/graph.json` from the project root.

For each active DECISION+RATIONALE+CONSTRAINT triple, append to `CLAUDE.md` in the project root under a `## Architectural Decisions (Crux)` section.

Format each triple as:

- **[decision content]** — [rationale content]. [constraint content if exists, prefixed with "Constraint:"]

If `CLAUDE.md` already has an `## Architectural Decisions (Crux)` section, append new decisions below existing ones. Do not duplicate decisions already present in the file.

If the graph has no active decisions, inform the user: "No active decisions to export. Crux captures decisions automatically during the session."

After appending, confirm what was exported: "Exported N decision(s) to CLAUDE.md."
