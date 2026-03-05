---
description: Trace why a specific decision was made by following its causal chain back to the root constraint
---

# Crux Why

The user wants to understand why a decision was made. The argument "$ARGUMENTS" is a search query for a decision.

1. Read the current Crux graph from `.claude/.crux/sessions/` in the project root (find the most recent `.json` file, or the one matching the current session)
2. Find the DECISION atom whose content best matches the query (case-insensitive substring match)
3. Trace its full causal chain backwards through `dependsOn` links
4. Display the chain from root to leaf

Format:
```
Decision: Use REST not GraphQL
  └─ Rationale: REST is the only viable choice given team skills
     └─ Constraint: Team only knows REST — GraphQL is not an option
        └─ Stakeholder: Backend team lead (if present)
```

If multiple decisions match, show all of them. If no match is found, list all active decisions so the user can pick one.
