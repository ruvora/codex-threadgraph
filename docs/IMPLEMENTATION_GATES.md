# Implementation gates

Implementation proceeds only after the preceding gate has durable failure-path tests.

## G0 — Contract fixtures

- malformed scope and out-of-scope reference rejection;
- mutable title cannot replace native identity;
- exact, extracted, and inferred evidence remain distinct;
- contradiction and supersession false-positive fixtures;
- recommendation cannot start or resume a thread.

Exit: tests fail for the intended reasons against the unimplemented core.

## G1 — Domain model and immutable revisions

- typed IDs and schema validators;
- Graph Revision construction and evidence closure;
- relation lifecycle and invalidation;
- deterministic fingerprints.

Exit: no current edge exists without a complete evidence path.

## G2 — Scoped source adapter

- native thread list and bounded read adapter;
- host and project identity normalization;
- explicit scope and resource budgets;
- unreadable, missing, and deleted distinction;
- untrusted-content isolation.

Exit: an out-of-scope thread cannot be read even when referenced by indexed content.

## G3 — Persistent local Registry

- versioned SQLite schema;
- atomic publication and current revision pointer;
- single-writer lease and fencing;
- migration backup, reopen, and restart recovery;
- thread, project, and full-index deletion.

Exit: forced termination at every publication stage produces either the old or new complete revision, never a partial graph.

## G4 — Extraction and exact relationships

- topic, decision, constraint, artifact, and result extraction;
- exact lineage and artifact relationships;
- incremental digest reuse;
- source change invalidation.

Exit: unchanged ranges are not reprocessed and changed evidence invalidates only dependents.

## G5 — Bounded inference

- relation-specific candidate generation;
- confidence calibration and thresholds;
- alternatives and conflict preservation;
- model and policy revision tracking.

Exit: topic overlap cannot produce contradiction or supersession without the required semantics.

## G6 — Selection and specialization

- eligibility gate and dimensioned ranking;
- all four Selection Report outcomes;
- suggested, confirmed, rejected, and superseded specialization revisions;
- explicit user acceptance boundary.

Exit: every recommendation explains evidence, missing context, freshness, and conflicts.

## G7 — MCP and graph experience

- read-only query API;
- graph, evidence, candidate comparison, and empty states;
- native navigation without prompt submission;
- responsive and accessible visual semantics;
- large-scope latency and memory budgets.

Exit: exact, extracted, and inferred relations remain distinguishable without color alone.

## G8 — Optional ThreadHub adapter

- versioned, fingerprinted Context Pack;
- explicit selection and export;
- consumer validation fixtures;
- independent failure and upgrade behavior.

Exit: a forged, stale, conflicted, or unsupported pack cannot influence execution planning.
