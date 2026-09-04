# Quality and calibration contract

## Fixture corpus

Calibration uses sanitized, versioned fixtures containing:

- exact native lineage and artifact relationships;
- Korean, English, and mixed-language topics and aliases;
- proposals, questions, rejected options, and accepted decisions;
- true and false contradiction examples;
- later-but-not-superseding content;
- stale, partial, missing, and unreadable sources;
- clear winner, close tradeoff, no candidate, and incomplete selection cases.

Training or prompt-tuning examples are separated from evaluation fixtures. Fixture changes create a corpus revision and preserve previous results.

## Hard invariants

The following require 100% pass rate:

- every current semantic value has evidence closure;
- exact edges match native evidence;
- no out-of-scope source is read;
- proposal, question, or rejected content is not promoted to an active decision;
- recency alone never creates `supersedes`;
- topic overlap alone never creates `contradicts`;
- query, inspection, and navigation never trigger indexing or a native Turn;
- identical input and policy produce identical deterministic values.

## Initial quality gates

| Metric | G5/G6 target |
|---|---:|
| High-band inferred-edge precision | at least 0.95 |
| Medium-band inferred-edge precision | at least 0.85 |
| Contradiction precision | at least 0.98 |
| Supersession precision | 1.00 on accepted fixtures |
| Active decision and constraint precision | at least 0.95 |
| Recommended outcome correctness | at least 0.90 |
| Unsafe recommendation rate with blocking conflict | 0 |
| Correct abstention for incomplete evidence | at least 0.95 |
| Deterministic replay mismatch | 0 |

Recall is reported but does not override precision for contradiction, supersession, authority, or recommendation. It is safer to retain an unresolved candidate than publish a false authoritative relationship.

## Operational measurements

Every indexing fixture records enumerated threads, deep-read threads, source characters, model input and output tokens when available, candidate pairs, accepted and rejected relations, elapsed time, peak memory, reused observations, invalidated projections, and published coverage.

Budget changes require measured evidence rather than a larger prompt. A quality improvement that exceeds the resource ceiling remains a proposed policy until the budget decision is reviewed.

## Policy promotion

An `alpha` policy becomes stable only when:

1. hard invariants pass;
2. quality targets pass on a held-out corpus;
3. replay is deterministic for derived numeric values;
4. Korean and English fixture slices show no material unexplained regression;
5. before-and-after reports and known limitations are recorded.

The initial deterministic policy promotion is recorded in [Held-out calibration: corpus v1](../evidence/CALIBRATION_HELD_OUT_V1.md). This promotion covers validated envelope and query-policy behavior. It does not promote unconstrained raw-language model interpretation, which remains a live E2E concern.

The initial view-performance and privacy measurements are recorded in [MCP Apps and large-graph verification v1](../evidence/LARGE_GRAPH_MCP_APPS_V1.md).

The accepted `index-policy/1-alpha` ceiling measurements are recorded in [Initial indexing budget verification v1](../evidence/INDEX_BUDGET_V1.md).
