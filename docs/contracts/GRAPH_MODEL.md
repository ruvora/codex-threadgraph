# Graph model contract

## Node types

- `project`: canonical workspace or project identity
- `thread`: native Codex thread identity
- `topic`: normalized subject discussed by one or more threads
- `decision`: an explicit choice with provenance
- `constraint`: a requirement or prohibition with provenance
- `artifact`: a file, patch, commit, report, or other produced output
- `result`: a structured observed outcome

## Edge classes

Exact edges come from host or repository evidence:

- `belongs_to`
- `forked_from`
- `produced`
- `validated`
- `references`

Inferred edges require confidence and explanation:

- `related_to`
- `continues`
- `contradicts`
- `supersedes`
- `specializes_in`

## Required fields

Every node records a stable logical ID, immutable Node Revision ID, kind, scope ID, canonical subject key, lifecycle state, provenance references, and containing Graph Revision ID. Every edge records a stable Logical Relation ID, immutable Relation Revision ID, source node, target node, relation kind, evidence class, supporting evidence IDs, lifecycle, and containing Graph Revision ID. Inferred edges additionally record calibrated confidence, explanation, inference version, and materially plausible alternatives.

IDs are content-derived only when the underlying identity is immutable. Mutable labels, summaries, confidence, and titles never participate in native thread identity.

## Relation semantics

- `belongs_to` is directional and exact.
- `forked_from` is directional, exact, and acyclic within one host lineage.
- `references` is directional and does not imply agreement.
- `related_to` is symmetric only within the published revision that derived it.
- `continues` is directional and requires subject continuity plus later evidence.
- `contradicts` requires the same subject, incompatible assertions, and overlapping validity; topic overlap alone is insufficient.
- `supersedes` requires explicit replacement evidence or an accepted user decision; recency alone is insufficient.
- `specializes_in` links a thread profile to demonstrated evidence and never grants execution capability.

## Evidence closure

Every current node and edge must resolve to immutable Evidence Items. An Evidence Item resolves to an Observation, and an Observation resolves to an authorized native source range or artifact identity inside the Graph Revision scope and cutoff. Observation and Evidence Item IDs are recomputed from provenance. A missing, unauthorized, out-of-scope, cutoff-exceeding, or hash-mismatched path rejects publication or invalidates the dependent projection.

## Revision behavior

Graph revisions are immutable. Re-extraction, new source content, user conflict resolution, and inference model changes create a new revision. Historical edges are superseded or invalidated rather than overwritten.

## Projection rule

A direct thread-to-thread edge is a projection over underlying evidence. The graph must retain the evidence path that produced it. A similarity score without an inspectable evidence path is not a valid relationship.

Deterministic scores and thresholds are defined in [Value derivation](./VALUE_DERIVATION.md). Identity and record shapes are defined in [Data schema and IDs](./DATA_SCHEMA_AND_IDS.md).
