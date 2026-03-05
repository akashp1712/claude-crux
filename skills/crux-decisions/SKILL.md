---
description: List all active decisions tracked by Crux with their rationales and constraints
---

# Crux Decisions

Read the current Crux graph from `.claude/.crux/sessions/` in the project root (find the most recent `.json` file, or the one matching the current session) and list all DECISION-type atoms with status ACTIVE.

For each decision, show:
- The decision content
- Its linked rationale (follow `dependsOn` links to RATIONALE atoms)
- Its linked constraint (follow `dependsOn` links to CONSTRAINT atoms)
- The turn it was established
- Its confidence score

Also show any SUPERSEDED decisions (with what superseded them) in a separate section.

If no decisions are tracked, report that no decisions have been captured yet. Remind the user that Crux captures decisions automatically during conversation.
