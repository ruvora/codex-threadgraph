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

- `scopeKind`: `project`, `thread_set`, or `query_bounded`;
- canonical project identity when applicable;
- explicit native thread IDs or deterministic candidate rule;
- request origin and observation time;
- maximum threads and source range budget;
- whether derived records may persist locally.

An indexing request cannot widen its own scope. A link to an out-of-scope thread may be recorded as an unresolved reference but must not trigger a read.

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
