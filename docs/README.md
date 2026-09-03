# Design documentation index

This directory defines the implementation contract for Codex ThreadGraph. A behavior not described here is not silently authorized by a prompt, inferred relationship, or UI action.

## Reading order

1. [Product direction](./PRODUCT_DIRECTION.md)
2. [Architecture](./ARCHITECTURE.md)
3. [Terminology](./TERMINOLOGY.md)
4. [ADR-001: heterogeneous evidence graph](./adr/ADR-001-HETEROGENEOUS-EVIDENCE-GRAPH.md)
5. [ADR-002: independent read-only boundary](./adr/ADR-002-INDEPENDENT-READ-ONLY-BOUNDARY.md)
6. [ADR-003: explicit incremental indexing](./adr/ADR-003-EXPLICIT-INCREMENTAL-INDEXING.md)
7. [ADR-004: recommendation is not authority](./adr/ADR-004-RECOMMENDATION-NOT-AUTHORITY.md)
8. [Graph model](./contracts/GRAPH_MODEL.md)
9. [Source ingestion](./contracts/SOURCE_INGESTION.md)
10. [Inference and authority](./contracts/INFERENCE_AND_AUTHORITY.md)
11. [Selection and specialization](./contracts/SELECTION_AND_SPECIALIZATION.md)
12. [State and persistence](./contracts/STATE_AND_PERSISTENCE.md)
13. [Privacy and indexing](./contracts/PRIVACY_AND_INDEXING.md)
14. [Host and navigation](./contracts/HOST_AND_NAVIGATION.md)
15. [Graph experience](./contracts/GRAPH_EXPERIENCE.md)
16. [ThreadHub interoperability](./contracts/THREADHUB_INTEROP.md)
17. [Implementation gates](./IMPLEMENTATION_GATES.md)
18. [Review checklist](./REVIEW_CHECKLIST.md)

## Authority

- Native Codex thread history is authoritative for what occurred in a thread.
- Explicit user decisions are authoritative for accepted labels, scope, and conflict resolution.
- The local Graph Registry is authoritative only for derived observations, graph revisions, and invalidation state.
- ThreadGraph never becomes execution authority.
- When code and a contract disagree, execution must fail closed and the discrepancy must be fixed explicitly.

## Change rule

Changes to scope, evidence precedence, relation semantics, persistence, selection, privacy, navigation, or interoperability require a contract update and failure-path tests in the same change.
