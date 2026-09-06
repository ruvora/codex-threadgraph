# RUVORA Codex ThreadGraph

> An evidence-backed context graph for understanding, specializing, and selecting Codex threads.

Codex threads accumulate decisions, constraints, experiments, artifacts, and execution history. ThreadGraph turns that scattered context into a local relationship graph without treating similarity as authority or starting work on the user's behalf.

## Why ThreadGraph exists

Returning to a project raises questions that thread titles and recency cannot answer: which decision still applies, where did a constraint come from, and which conversation is worth continuing? ThreadGraph makes those relationships inspectable. Its useful output is an explanation with a path back to the evidence.

**Similarity is a lead, not authority.** Exact lineage, observed facts and inferred relationships remain distinct. Contradictions and superseded decisions stay visible instead of disappearing into a single summary. A recommendation is relative to a goal and the available evidence; the user or consuming execution system still decides what to do. Local storage, explicit indexing scope and bounded retention put the cost and privacy of this discovery process under deliberate control.

## Product boundary

ThreadGraph is a read-only knowledge and navigation layer.

| Product | Responsibility |
|---|---|
| **Codex ThreadGraph** | Read, index, relate, explain, recommend, and navigate threads |
| **Codex ThreadHub** | Validate contracts, orchestrate work, recover execution, integrate artifacts, and decide completion |
| **Codex Desktop** | Own native conversation history and the user-facing thread experience |

ThreadGraph does not execute Tasks, mutate source projects, archive threads, grant authority, or alter ThreadHub state. Indexing and retention operations write its own derived local registry.

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

## Technical architecture

```text
Explicit project scope -> bounded source observations -> evidence extraction
  -> exact and inferred relations -> validated SQLite graph revision
  -> goal-relative selection report -> evidence inspection / native navigation
```

Source ingestion and publication are separate from queries. Durable prepare/extract/publish sessions freeze scope and source fingerprints; validation checks that claims and relations retain their evidence before a revision becomes current. SQLite provides atomic publication and recovery, while immutable revisions give each query a consistent basis. Failed extraction leaves the previous published graph available.

Inference uses bounded candidates and calibrated deterministic policy; semantic extraction input remains untrusted. Queries and the MCP Apps view read a published revision without starting a refresh. Context Packs carry versioned provenance across the optional Hub boundary, where the consumer validates them independently. The products keep separate databases and authority. See [architecture](./docs/ARCHITECTURE.md) and the [generation pipeline](./docs/GENERATION_PIPELINE.md).

## Direction

The direction is to improve the usefulness of evidence-backed selection and specialization while keeping indexing explicit, local and bounded. Persistent revisions, graph interaction and Context Pack contracts have alpha implementations; stable delivery still depends on the installed-host and graph-open acceptance described below. The [roadmap](./ROADMAP.md) separates these workstreams. Graph should remain independently useful for understanding threads even when no orchestration plugin is connected.

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

## Run from source

Install Node.js 24+ on PATH. No external npm runtime dependencies are required.

```sh
git clone https://github.com/ruvora/codex-threadgraph.git
cd codex-threadgraph
npm test
# Start a stdio MCP server for a configured MCP client:
node server/threadgraph-mcp.mjs
```

The stdio server waits for client protocol messages; it does not open a browser. Plugin metadata and the launcher are in `.codex-plugin/plugin.json` and `.mcp.json`. Set `CODEX_MCP_NODE_PATH` to an absolute Node executable if it is not on PATH. Native source access requires an authenticated Codex CLI; `CODEX_CLI_PATH` can select its executable. Index preparation requires both a stable `canonicalProjectId` and an absolute `canonicalProjectPath`. Supply an explicit authorized scope; cloning does not install or index anything.

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

`0.1.0` alpha implementation with executable G0–G12 test coverage. It includes scoped native-source adaptation, durable prepare/extract/publish sessions, terminal source scrubbing, preview-confirmed local retention controls, immutable graph construction, a versioned SQLite Registry, calibrated deterministic inference and selection gates, a local-only MCP server, a portable MCP Apps graph with relation filters and bounded rendering, validated Context Pack export, and an independently tested ThreadHub consumer boundary.

The implementation is not yet a stable release. The personal-marketplace package passes installed-cache MCP and real-scope indexing E2E; deterministic policy calibration, saturated indexing budgets, source-level MCP Apps performance and privacy gates, and independent ThreadHub consumer validation pass. The [desktop restart check](./docs/evidence/REBOOT_PROJECT_SCOPE_E2E.md) confirmed tool discovery and led to a corrected project ID/path contract, verified against the real host at source level. Installed-cache checks are revision-specific; final installed acceptance of the corrected build and graph-open E2E remain release gates. The repository does not claim those gates have passed.

## Author

Created and maintained by [ShinYEB](https://github.com/ShinYEB).
