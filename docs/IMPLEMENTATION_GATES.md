# Implementation gates

Implementation proceeds only after the preceding gate has durable failure-path tests.

## G0 — Contract fixtures

Status: complete. The red baseline was recorded before implementation, and the contract kernel now satisfies every seed fixture.

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

Status: complete for versioned SQLite publication, fencing, backup migration, reopen, interrupted-job recovery, terminal source scrubbing, retention inspection, and preview-confirmed indexed-thread deletion. Deletion publishes an invalidating revision and purges affected historical revisions and exports without modifying native Codex history.

- versioned SQLite schema;
- atomic publication and current revision pointer;
- single-writer lease and fencing;
- migration backup, reopen, and restart recovery;
- thread, project, and full-index deletion.
- terminal and expired-session source scrubbing;
- revision-bound deletion preview and explicit confirmation.

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

Status: deterministic policy gate complete. The sanitized evaluation-only corpus meets every documented precision target across English, Korean, and mixed-language slices. Raw-language interpretation remains part of the final live graph-open E2E rather than authority inside this policy layer.

- relation-specific candidate generation;
- confidence calibration and thresholds;
- deterministic confidence bands and relation-strength projection;
- alternatives and conflict preservation;
- model and policy revision tracking.

Exit: topic overlap cannot produce contradiction or supersession without the required semantics.

## G6 — Selection and specialization

Status: deterministic policy gate complete. Held-out recommendation correctness, blocking-conflict safety, incomplete-evidence abstention, normalization, and deterministic replay meet the documented targets across all language slices.

- eligibility gate and dimensioned ranking;
- deterministic versioned selection score and outcome thresholds;
- all four Selection Report outcomes;
- suggested, confirmed, rejected, and superseded specialization revisions;
- explicit user acceptance boundary.

Exit: every recommendation explains evidence, missing context, freshness, and conflicts.

G5 and G6 also require the targets in [Quality and calibration](./contracts/QUALITY_AND_CALIBRATION.md).

Evidence: [Held-out calibration: corpus v1](./evidence/CALIBRATION_HELD_OUT_V1.md).

## G7 — MCP and graph experience

Status: source-level gate complete. The MCP server exposes a decoupled render tool and portable MCP Apps resource, relation and evidence filters, an accessible bounded SVG/list surface, owner-only local storage files, and measured large-scope latency, memory, payload, and privacy budgets. Installed desktop rendering remains part of the final user-visible E2E.

- read-only query API;
- graph, evidence, candidate comparison, and empty states;
- native navigation without prompt submission;
- responsive and accessible visual semantics;
- large-scope latency and memory budgets.

Exit: exact, extracted, and inferred relations remain distinguishable without color alone.

Evidence: [MCP Apps and large-graph verification v1](./evidence/LARGE_GRAPH_MCP_APPS_V1.md).

## G8 — Optional ThreadHub adapter

Status: producer-side Context Pack creation and validation implemented. An independent ThreadHub consumer compatibility run remains open.

- versioned, fingerprinted Context Pack;
- explicit selection and export;
- consumer validation fixtures;
- independent failure and upgrade behavior.

Exit: a forged, stale, conflicted, or unsupported pack cannot influence execution planning.

## G9 — End-to-end indexing session

Status: installed-runtime implementation complete. The durable two-stage session, native App Server adapter, deterministic G2–G6 composition, atomic publication, and local-only MCP tools are covered by failure-path, real-host forward, and installed-cache E2E tests. Automatic tool discovery in a newly opened Codex task remains the final user-visible G9 release check.

- durable prepare, publish, cancel, failure, and interruption states;
- one frozen request and source fingerprint per session;
- current-Turn Extraction Envelope handoff;
- publish-time scope, lease, expiry, and fingerprint revalidation;
- deterministic G2–G6 pipeline composition;
- atomic Graph Revision, job, session, pointer, and lease commit;
- MCP tools that expose no native thread execution authority.

Exit: a successful initial open or explicit refresh produces one complete queryable Graph Revision, while every contract failure leaves the previous revision current.

Evidence: [Installed plugin E2E: 0.1.0](./evidence/INSTALLED_PLUGIN_E2E_0.1.0.md).
