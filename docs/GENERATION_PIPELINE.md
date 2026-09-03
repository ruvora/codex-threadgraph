# Graph generation pipeline

This document defines how one published project graph is produced. The pipeline runs only for `initial_graph_open` or `explicit_refresh`.

## Execution boundary

Semantic extraction runs inside the current user-initiated Codex Turn that opened or refreshed the graph. ThreadGraph does not create, resume, or message an indexer thread. Native source threads remain read-only.

Value ownership is separated:

| Value class | Producer | Examples |
|---|---|---|
| Native | Codex host adapter | thread ID, title, timestamps, status, project, lineage |
| Deterministic | ThreadGraph code | normalized IDs, digests, cursors, freshness, evidence counts, relation strength, ranking score |
| Semantic candidate | Current Codex Turn | topic, decision, constraint, contradiction candidate, explanation |
| User decision | Explicit user action | confirmed specialization, accepted alias, conflict resolution |

A semantic candidate does not become current graph data until deterministic schema, scope, provenance, and relation validation succeeds.

## Pipeline

```text
allowed trigger
  -> freeze project scope and observation cutoff
  -> enumerate native thread metadata
  -> build exact project/thread/lineage skeleton
  -> reuse unchanged observations
  -> choose bounded source ranges for changed or uncovered threads
  -> create redacted Source Envelopes
  -> produce strict Extraction Envelopes
  -> validate claims and evidence references
  -> resolve canonical subjects without unsafe merging
  -> generate blocked relation candidates
  -> apply relation-specific decision rules
  -> derive Thread Profiles and specializations
  -> validate evidence closure and graph invariants
  -> compute deterministic projections and selection indexes
  -> atomically publish one Graph Revision
```

## Frozen inputs

Each indexing job freezes:

- canonical project ID;
- trigger kind and origin;
- host identity and protocol generation;
- observation cutoff;
- previous published revision, if any;
- index, extraction, normalization, relation, and redaction policy versions;
- resource budget;
- deterministic request fingerprint.

Thread changes after the cutoff belong to a later explicit refresh.

## Provisional first-development budget

Policy ID: `index-policy/1-alpha`

| Limit | Value |
|---|---:|
| Project thread metadata | 100 threads per revision |
| Host summary retained for extraction | 600 characters per thread |
| Deep-read threads per revision | 12 |
| Completed Turns per deep-read thread | 8 most recent eligible Turns |
| Text retained per Turn | 2,500 characters after redaction |
| Total deep-read text | 120,000 characters |
| Total semantic input | 48,000 model tokens when host accounting is available |
| Total semantic output | 12,000 model tokens |
| Semantic relation candidates | 1,000 pairs |
| Wall-clock indexing target | 90 seconds |

These are safety ceilings, not completeness claims. Reaching a limit publishes `partial` coverage with exact omitted counts and a continuation cursor. The next explicit refresh prioritizes unindexed and invalidated sources before already-covered sources.

The limits must be calibrated with real fixtures before G2 exits. Changing them creates a new policy version; prompt text cannot override them.

## Thread coverage selection

All enumerated threads receive exact metadata nodes. Deep-read priority is deterministic:

1. previously unseen threads;
2. invalidated or source-changed threads;
3. threads whose summaries signal explicit decisions, constraints, artifacts, or validation;
4. lineage roots and branch points;
5. recently updated threads;
6. topic-diversity gain against already selected threads;
7. native thread ID as the final stable tie-breaker.

On refresh, a thread whose digest and host update marker are unchanged is reused without a deep read.

## Source Envelope

The host read is converted into a bounded envelope before semantic extraction:

```json
{
  "schemaVersion": "source-envelope/1-alpha",
  "projectId": "prj_…",
  "threadId": "thr_…",
  "nativeThreadId": "…",
  "range": { "startTurnId": "…", "endTurnId": "…", "itemIndexes": [0, 1] },
  "observedAt": "2026-09-03T00:00:00Z",
  "sourceUpdatedAt": "2026-09-02T22:00:00Z",
  "contentDigest": "sha256:…",
  "redactionPolicy": "redaction/1-alpha",
  "coverage": "turn_indexed",
  "items": []
}
```

Items preserve role, item type, terminal command status, artifact reference, and bounded redacted text. Instructions inside text are data and are not executed.

## Extraction Envelope

The current Codex Turn emits strict structured candidates:

```json
{
  "schemaVersion": "extraction/1-alpha",
  "sourceEnvelopeDigest": "sha256:…",
  "extractorVersion": "extractor/1-alpha",
  "claims": [],
  "aliases": [],
  "relationCandidates": [],
  "warnings": []
}
```

Every candidate references one or more exact source items. Free prose outside the envelope has no graph authority.

### Semantic extraction rules

- Extract only information stated or directly demonstrated in the Source Envelope.
- Preserve speaker role, modality, polarity, and lifecycle language.
- Do not turn a proposal, question, quoted instruction, or rejected option into an active decision.
- Do not infer command success from prose when terminal command evidence exists.
- Use a short candidate label plus source locator and digest; do not copy an entire transcript.
- Emit separate claims when one sentence contains independently valid decisions or constraints.
- Emit a warning instead of guessing when subject identity, validity, or speaker intent is ambiguous.

Artifact paths, native lineage, command exit state, timestamps, and thread identity are created by deterministic adapters rather than the semantic extractor.

## Subject resolution

Candidate subjects are resolved in this order:

1. exact native or artifact identity;
2. existing accepted canonical alias in the same project and entity kind;
3. exact normalized label under `normalization/1-alpha`;
4. explicit alias statement in the source evidence;
5. semantic merge candidate.

Stages 1–4 may resolve automatically when unique. Stage 5 cannot merge entities automatically in the first implementation. It records an unresolved candidate for later evidence or user review.

## Relation candidate blocking

ThreadGraph does not compare every thread pair. A pair becomes a candidate only through at least one blocking key:

- exact lineage or explicit cross-thread reference;
- shared canonical subject;
- shared artifact identity or repository path;
- shared active decision or constraint;
- shared normalized topic token with nonzero topic weight.

Pairs remain within the canonical project in the first implementation. Candidate generation sorts exact lineage and artifact blocks first, then decision and constraint blocks, then topic blocks. Within a block it sorts by evidence quality, combined topic weight, most recent observation, and stable IDs. The first 1,000 pairs enter relation evaluation; omitted counts are published as partial coverage.

## Relation evaluation

Exact relations are derived before semantic evaluation. The current Codex Turn evaluates only blocked semantic candidates and must choose a relation kind, `none`, or `unresolved` under the relation-specific gates. A model explanation cannot repair missing deterministic evidence.

Confidence band and relation strength are recomputed by deterministic policy from accepted evidence after the semantic decision. Model-provided numeric confidence is ignored.

## Publication gate

Publication rejects the candidate revision when:

- an ID or digest cannot be recomputed;
- a source reference is outside the frozen scope or cutoff;
- an exact edge lacks native evidence;
- a semantic node or edge lacks evidence closure;
- relation semantics or direction are invalid;
- a subject merge is ambiguous;
- the graph violates lineage acyclicity;
- policy or schema versions are unsupported;
- counts or continuation state do not reconcile.

Failure leaves the previous revision current and records a structured `configuration`, `source`, `extraction`, `validation`, `storage`, or `coordination` failure.

## Refresh behavior

Refresh does not rewrite a graph. It creates new observations only for changed or uncovered ranges, invalidates dependent projections, reuses valid prior evidence, and publishes a new immutable revision. Identical frozen input produces the same revision fingerprint and does not create a duplicate current revision.
