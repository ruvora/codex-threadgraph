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

The first release intentionally performs no background crawling and requires no external embedding service.

## Design documents

- [Product direction](./docs/PRODUCT_DIRECTION.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Graph model contract](./docs/contracts/GRAPH_MODEL.md)
- [Inference and authority contract](./docs/contracts/INFERENCE_AND_AUTHORITY.md)
- [Privacy and indexing contract](./docs/contracts/PRIVACY_AND_INDEXING.md)
- [Roadmap](./ROADMAP.md)

## Status

`0.1.0` design baseline and read-only skill scaffold. A persistent index, MCP server, and interactive graph application are planned but are not advertised as implemented.

## Author

Created and maintained by [ShinYEB](https://github.com/ShinYEB).
