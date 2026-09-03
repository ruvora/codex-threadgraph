---
name: thread-context-graph
description: Build an evidence-backed relationship map from Codex threads when the user wants to understand thread context, compare or specialize threads, find conflicts, or choose the best thread for a goal. This skill is read-only and does not orchestrate or execute work.
---

# Thread Context Graph

Map relationships between Codex threads within the user's requested scope.

## Workflow

1. Resolve the scope from an explicit project, explicit thread set, or bounded user request. Do not crawl unrelated threads.
2. Use available native thread listing and reading capabilities without opening or mutating conversations.
3. Separate observed lineage and metadata from extracted statements and semantic inference.
4. Build nodes and edges according to [the graph contract](references/graph-contract.md).
5. For a selection request, rank candidates against the stated goal and explain evidence, freshness, conflicts, missing context, and confidence.
6. Navigate to a thread only when the user asks to open or select it and the host provides native navigation.

## Constraints

- Remain read-only. Do not start Turns, resume threads, archive threads, modify projects, or invoke an orchestrator.
- Never treat similarity, role names, or specialization labels as authority.
- Every relationship must have an inspectable evidence path. Label model-derived edges as inferred.
- Avoid reproducing full private transcripts. Use concise derived summaries and source references.
- Do not use an external embedding or analytics service unless the user explicitly requests and authorizes it.
- When evidence is missing or contradictory, preserve uncertainty instead of inventing a connection.

## Output

Return the smallest useful graph plus:

- scope and observation time;
- candidate threads and native IDs when available;
- typed relationships with evidence class and confidence;
- conflicts, stale context, and missing evidence;
- goal-relative recommendation, if requested;
- navigation choices, if supported.
