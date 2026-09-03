---
name: thread-context-graph
description: Build an evidence-backed relationship map from Codex threads when the user wants to understand thread context, compare or specialize threads, find conflicts, or choose the best thread for a goal. This skill is read-only and does not orchestrate or execute work.
---

# Thread Context Graph

Map relationships between Codex threads within the user's requested scope.

## Workflow

1. Resolve the canonical project whose graph the user is viewing. Do not crawl unrelated projects or threads.
2. Update the index only when this is the project's first graph open with no published revision, or when the user explicitly requests refresh.
3. For search, selection, inspection, and navigation, read the current published Graph Revision without updating it. Report missing or stale data with the appropriate next action.
4. During an allowed update, use available native thread listing and bounded reading capabilities without opening or mutating conversations.
5. Separate observed lineage and metadata from extracted statements and semantic inference.
6. Build nodes and edges according to [the graph contract](references/graph-contract.md).
7. For a selection request, rank candidates against the stated goal and explain evidence, freshness, conflicts, missing context, and confidence.
8. Navigate to a thread only when the user asks to open or select it and the host provides native navigation.

For an allowed initial build or Refresh, read [the generation pipeline](../../docs/GENERATION_PIPELINE.md). When deriving relationship strength, specialization, or a Selection Report, read [the value derivation contract](../../docs/contracts/VALUE_DERIVATION.md). Do not invent replacement weights or budgets in prompt text.

## Constraints

- Remain read-only. Do not start Turns, resume threads, archive threads, modify projects, or invoke an orchestrator.
- Do not refresh because of a Goal Query, search, node selection, navigation, application launch, elapsed time, thread creation, or ThreadHub activity.
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
