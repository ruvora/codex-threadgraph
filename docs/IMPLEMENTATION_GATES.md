# Implementation gates

Implementation proceeds only after the preceding gate has durable failure-path tests.

## G0 — Contract fixtures

Status: complete. The red baseline was recorded before implementation, and the contract kernel now satisfies every seed fixture. G1 and G2 remain open for immutable graph revisions and the native scoped-source adapter.

- malformed scope and out-of-scope reference rejection;
- indexing starts only for first project-graph open and explicit refresh;
- Goal Query, search, inspection, navigation, app launch, TTL, and ThreadHub activity cannot start indexing;
- mutable title cannot replace native identity;
- exact, extracted, and inferred evidence remain distinct;
- contradiction and supersession false-positive fixtures;
- recommendation cannot start or resume a thread.
- deterministic ID, digest, freshness, confidence-band, relation-strength, and selection-score fixtures;
- model-provided numeric confidence cannot enter the published graph.

Exit: tests fail for the intended reasons against the unimplemented core.

## G1 — Domain model and immutable revisions

Status: complete. The immutable domain builder, strict Source and Extraction Envelope validators, typed IDs, evidence closure, deterministic fingerprints, and Relation Revision transitions are implemented and covered by failure-path tests.

- typed IDs and schema validators;
- Graph Revision construction and evidence closure;
- relation lifecycle and invalidation;
- deterministic fingerprints.
- typed source and extraction envelope validation.

Exit: no current edge exists without a complete evidence path.

## G2 — Scoped source adapter

Status: core implementation complete. Live installed-plugin compatibility remains part of the release E2E gate.

- native thread list and bounded read adapter;
- host and project identity normalization;
- explicit scope and resource budgets;
- idempotent initial-open and coalesced explicit-refresh triggers;
- unreadable, missing, and deleted distinction;
- untrusted-content isolation.

Exit: an out-of-scope thread cannot be read even when referenced by indexed content.

## G3 — Persistent local Registry

Status: core implementation complete for versioned SQLite publication, fencing, backup migration, reopen, and interrupted-job recovery. Fine-grained source retention/deletion UX remains a release task.

- versioned SQLite schema;
- atomic publication and current revision pointer;
- single-writer lease and fencing;
- migration backup, reopen, and restart recovery;
- thread, project, and full-index deletion.

Exit: forced termination at every publication stage produces either the old or new complete revision, never a partial graph.

## G4 — Extraction and exact relationships

Status: core implementation complete with deterministic claim materialization, ambiguity rejection, exact lineage validation, digest reuse, and dependent invalidation planning.

- topic, decision, constraint, artifact, and result extraction;
- modality, polarity, lifecycle, and speaker-role preservation;
- canonical subject resolution with ambiguous merge rejection;
- exact lineage and artifact relationships;
- incremental digest reuse;
- source change invalidation.

Exit: unchanged ranges are not reprocessed and changed evidence invalidates only dependents.

## G5 — Bounded inference

Status: alpha implementation complete. The gate remains open until the held-out calibration corpus meets the documented precision targets.

- relation-specific candidate generation;
- confidence calibration and thresholds;
- deterministic confidence bands and relation-strength projection;
- alternatives and conflict preservation;
- model and policy revision tracking.

Exit: topic overlap cannot produce contradiction or supersession without the required semantics.

## G6 — Selection and specialization

Status: alpha implementation complete. The gate remains open until held-out recommendation and abstention calibration meets the documented targets.

- eligibility gate and dimensioned ranking;
- deterministic versioned selection score and outcome thresholds;
- all four Selection Report outcomes;
- suggested, confirmed, rejected, and superseded specialization revisions;
- explicit user acceptance boundary.

Exit: every recommendation explains evidence, missing context, freshness, and conflicts.

G5 and G6 also require the targets in [Quality and calibration](./contracts/QUALITY_AND_CALIBRATION.md).

## G7 — MCP and graph experience

Status: alpha read-only MCP server, native-navigation boundary, view model, and accessible graph surface implemented. Large-scope latency/memory measurements and live embedded-app packaging remain open.

- read-only query API;
- graph, evidence, candidate comparison, and empty states;
- native navigation without prompt submission;
- responsive and accessible visual semantics;
- large-scope latency and memory budgets.

Exit: exact, extracted, and inferred relations remain distinguishable without color alone.

## G8 — Optional ThreadHub adapter

Status: producer-side Context Pack creation and validation implemented. An independent ThreadHub consumer compatibility run remains open.

- versioned, fingerprinted Context Pack;
- explicit selection and export;
- consumer validation fixtures;
- independent failure and upgrade behavior.

Exit: a forged, stale, conflicted, or unsupported pack cannot influence execution planning.
