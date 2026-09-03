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

Version 0.1 uses explicit, on-demand scope and host-provided thread listing and reading. It stores no background crawler and uses no external embedding provider. Persistence and interactive graph UI require separate contracts before implementation.
