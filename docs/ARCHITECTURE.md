# Architecture

## Layers

```text
Native Codex thread metadata and selected history
  -> scope gate
  -> local incremental index
  -> evidence extraction
  -> typed graph
  -> relationship inference
  -> ranking and explanation
  -> graph view and native thread navigation
```

## Ownership

| Component | Owns | Does not own |
|---|---|---|
| Scope gate | Which projects and threads may be read | Authorization to execute work |
| Indexer | Local observations and source digests | Native thread history |
| Extractor | Candidate topics, decisions, constraints, and artifacts | Final truth or authority |
| Graph store | Typed nodes, edges, evidence, revisions | ThreadHub Registry state |
| Inference engine | Confidence-scored semantic relationships | Exact lineage or user decisions |
| Recommender | Goal-relative ranking and explanations | Automatic thread selection or execution |
| Navigator | Links back to native Codex threads | Conversation mutation |

## Integration boundary

ThreadGraph must remain useful without ThreadHub. A later optional adapter may export a signed, versioned Context Pack that ThreadHub can validate and choose to consume. ThreadGraph never writes directly into ThreadHub's Registry and its recommendation is not an execution contract.

## First implementation boundary

Version 0.1 indexes one canonical project only when its graph is opened without an existing revision or when the user explicitly refreshes it. All queries, inspection, and navigation read a published revision without updating it. It stores no background crawler and uses no external embedding provider.

The alpha implementation is split into independently testable modules:

| Gate | Module | Responsibility |
|---|---|---|
| G1 | `src/domain-*`, `src/domain/` | immutable records, IDs, evidence closure, revisions |
| G2 | `src/source-adapter.mjs` | scoped listing, bounded reads, trigger coalescing |
| G3 | `src/registry.mjs` | SQLite publication, leases, recovery, migration |
| G4 | `src/extraction.mjs` | claim materialization, exact edges, incremental invalidation |
| G5 | `src/inference.mjs` | blocked candidates and deterministic confidence bands |
| G6 | `src/selection.mjs` | Goal Queries, Selection Reports, specialization lifecycle |
| G7 | `src/graph-service.mjs`, `server/`, `ui/` | read-only MCP boundary, navigation, graph semantics |
| G8 | `src/context-pack.mjs` | provenance-only Context Pack export and validation |

## Canonical flow

```text
Scope Request
  -> Source Adapter
  -> immutable Observations
  -> extracted Evidence and Claims
  -> exact and candidate Relations
  -> evidence-closure validation
  -> atomic Graph Revision publication
  -> Goal Query
  -> immutable Selection Report
  -> evidence inspection or native navigation
```

Source ingestion and graph publication are separate from queries. A query reads one published revision and cannot trigger indexing or scope expansion. Navigation is separate from recommendation and starts no Turn.

## Failure boundaries

- Host access failure changes source availability, not native history.
- Extraction failure leaves the previous graph revision current.
- Inference failure cannot remove exact relationships.
- Query failure cannot mutate the graph.
- Navigation failure cannot choose a substitute thread.
- ThreadHub import failure cannot mutate the Graph Registry.

Detailed behavior is defined by the contracts in [the design index](./README.md).
