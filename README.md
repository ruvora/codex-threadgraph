# RUVORA Codex ThreadGraph

> An evidence-backed context graph for understanding, specializing, and selecting Codex threads.

Codex threads accumulate decisions, constraints, experiments, artifacts, and execution history. ThreadGraph turns that scattered context into a local relationship graph without treating similarity as authority or starting work on the user's behalf.

## Product boundary

ThreadGraph is a read-only knowledge and navigation layer.

| Product | Responsibility |
|---|---|
| **Codex ThreadGraph** | Read, index, relate, explain, recommend, and navigate threads |
| **Codex ThreadHub** | Validate contracts, orchestrate work, recover execution, integrate artifacts, and decide completion |
| **Codex Desktop** | Own native conversation history and the user-facing thread experience |

ThreadGraph does not execute Tasks, mutate projects, archive threads, grant authority, or alter ThreadHub state.

## Graph model

```text
Project
  ├─ Thread ──contains────▶ Decision
  │    ├────────about─────▶ Topic
  │    └────────produces──▶ Artifact
  ├─ Thread ──continues───▶ Thread
  ├─ Thread ──contradicts─▶ Decision
  └─ Thread ──validates───▶ Artifact
```

Thread-to-thread similarity is a derived view over evidence nodes. Every inferred relationship records its source, observation time, confidence, and explanation.

## Initial capability

The `thread-context-graph` skill can:

- inspect threads within an explicit project or user-selected scope;
- distinguish exact lineage from semantic inference;
- identify shared topics, decisions, constraints, artifacts, conflicts, and supersession;
- recommend a thread for a stated goal with an explanation;
- suggest evidence-backed specialization labels;
- navigate to a selected native Codex thread when the host supports it.

The first release updates a project graph only on its first open or an explicit Refresh action. Searches, recommendations, inspection, and navigation read the current revision without updating it. It performs no background crawling and requires no external embedding service.

The alpha runtime requires Node.js 24 or newer for the built-in SQLite Registry. The MCP server stores its local database under `$CODEX_HOME/threadgraph/graph.db` unless `THREADGRAPH_REGISTRY_PATH` is explicitly configured.

## Design documents

- [Product direction](./docs/PRODUCT_DIRECTION.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Graph generation pipeline](./docs/GENERATION_PIPELINE.md)
- [Complete design index](./docs/README.md)
- [Graph model contract](./docs/contracts/GRAPH_MODEL.md)
- [Data schema and IDs](./docs/contracts/DATA_SCHEMA_AND_IDS.md)
- [Source ingestion contract](./docs/contracts/SOURCE_INGESTION.md)
- [Inference and authority contract](./docs/contracts/INFERENCE_AND_AUTHORITY.md)
- [Value derivation contract](./docs/contracts/VALUE_DERIVATION.md)
- [Quality and calibration contract](./docs/contracts/QUALITY_AND_CALIBRATION.md)
- [Worked graph generation example](./docs/examples/GENERATION_EXAMPLE.md)
- [Selection and specialization contract](./docs/contracts/SELECTION_AND_SPECIALIZATION.md)
- [State and persistence contract](./docs/contracts/STATE_AND_PERSISTENCE.md)
- [Privacy and indexing contract](./docs/contracts/PRIVACY_AND_INDEXING.md)
- [Host and navigation contract](./docs/contracts/HOST_AND_NAVIGATION.md)
- [Graph experience contract](./docs/contracts/GRAPH_EXPERIENCE.md)
- [ThreadHub interoperability contract](./docs/contracts/THREADHUB_INTEROP.md)
- [Implementation gates](./docs/IMPLEMENTATION_GATES.md)
- [G0 test strategy](./test/README.md)
- [Roadmap](./ROADMAP.md)

## Status

`0.1.0` alpha implementation with executable G0–G8 contract coverage. It includes scoped native-source adaptation, immutable graph construction, a versioned SQLite Registry, deterministic extraction and inference gates, explainable selection, a read-only MCP server, an accessible graph view, and validated Context Pack export.

The implementation is not yet a stable release. G5/G6 corpus calibration, large-scope G7 performance measurements, live Codex packaging, and an independent ThreadHub consumer test remain release gates. The repository does not claim those checks have passed.

## Author

Created and maintained by [ShinYEB](https://github.com/ShinYEB).
