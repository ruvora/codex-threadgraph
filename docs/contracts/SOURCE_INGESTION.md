# Source ingestion contract

## Intake order

```text
resolve requested scope
  -> verify host visibility
  -> enumerate candidate threads
  -> select bounded source ranges
  -> compute source digests
  -> reuse unchanged observations
  -> extract claims from changed ranges
  -> build candidate edges
  -> validate evidence closure
  -> publish one graph revision atomically
```

No partial graph becomes current while extraction is in progress.

## Scope

Every indexing request records:

- `scopeKind`: `project` for the first implementation;
- canonical project identity when applicable;
- deterministic project-membership rule;
- request origin and observation time;
- maximum threads and source range budget;
- whether derived records may persist locally.

An indexing request cannot widen its own scope. A link to an out-of-scope thread may be recorded as an unresolved reference but must not trigger a read.

## Index update triggers

The first implementation permits exactly two triggers:

1. `initial_graph_open`: opening a canonical project's graph when that project has no published Graph Revision;
2. `explicit_refresh`: a user explicitly requests refresh for the currently selected project graph.

Opening a graph that already has a published revision is a read and does not update the index. Goal Queries, search, filters, node or edge inspection, navigation, application launch, elapsed TTL, native thread creation, and ThreadHub activity do not trigger indexing.

A Goal Query always reads one existing published revision. If none exists, the graph must be opened to perform initial indexing. If the revision is stale, the query reports staleness and the user may explicitly refresh; it does not refresh itself.

Concurrent equivalent initial-open or refresh requests coalesce under one project indexing lease. Completion publishes at most one new current revision for the same input digest.

An interrupted update may resume or retry only as continuation of its original allowed trigger. Restart, recovery, and retry are not independent update triggers.

## Source identity

A Source Thread identity includes host identity, native thread ID, canonical project identity when available, and stable lineage metadata supplied by the host. Titles are mutable labels and are never identifiers.

## Observation identity

An Observation is uniquely determined by source thread, source range, content digest, extractor version, and redaction policy version. Re-reading unchanged content is idempotent. A different extractor may create a new derived revision without rewriting old evidence.

## Failure behavior

- An unreadable requested thread is recorded as `unreadable`; no substitute content is invented.
- A missing thread is recorded as `missing` until the host confirms deletion.
- A changed source invalidates only dependent derived data.
- One failed thread may yield a partial Selection Report only when the missing evidence is explicit and the requested decision remains safe.
- Exact lineage must never be reconstructed from title similarity.

## Publication

A revision may publish only when every current node and edge has a complete evidence path or is explicitly marked unresolved. Publication uses one transaction and advances the scope's current revision pointer only after validation.
