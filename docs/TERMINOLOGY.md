# Terminology

| Term | Meaning |
|---|---|
| Source Thread | A native Codex thread observed within an authorized scope |
| Source Range | The bounded native history region used to produce an observation |
| Observation | Immutable record that a source range with a specific digest was inspected |
| Evidence Item | A source-backed fact used to support a node, edge, profile, or recommendation |
| Claim | Extracted topic, decision, constraint, artifact, or result with provenance |
| Graph Revision | Immutable, atomically published view of nodes and edges for one scope revision |
| Exact Edge | Relationship directly supplied by native metadata or artifact identity |
| Extracted Edge | Relationship explicitly stated in source content and linked to a source range |
| Inferred Edge | Model-derived relationship with evidence references and calibrated confidence |
| Thread Profile | Derived view of a thread's topics, strengths, freshness, conflicts, and continuity |
| Suggested Specialization | Evidence-backed label that has not been accepted as persistent identity |
| Confirmed Specialization | Label explicitly accepted by the user with a recorded revision |
| Goal Query | Read-only request used to rank threads for a stated objective |
| Selection Report | Immutable recommendation result with candidates, explanations, and uncertainty |
| Context Pack | Versioned export of selected claims and evidence references for another consumer |
| Invalidation | Durable record that derived data can no longer be treated as current |

“Relevant,” “current,” “authoritative,” and “available” are separate properties. Documentation and UI must not use one as a synonym for another.
