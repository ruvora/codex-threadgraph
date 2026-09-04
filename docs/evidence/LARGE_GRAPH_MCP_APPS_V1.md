# MCP Apps and large-graph verification v1

## Purpose

Verify that the graph UI is packaged as a portable MCP Apps resource, remains useful without the component, supports deterministic relation filters, bounds DOM rendering, and meets explicit latency, memory, payload, and privacy budgets.

The packaging follows the [official OpenAI plugin UI guidance](https://developers.openai.com/plugins/build/chatgpt-ui): a dedicated render tool declares `_meta.ui.resourceUri`, the server exposes a `text/html;profile=mcp-app` resource, the iframe uses the JSON-RPC bridge, and data tools remain independent of the UI.

## Contract

- Resource URI: `ui://threadgraph/graph.html`
- Data tools: graph query, evidence, selection, indexing, and retention tools
- Render tool: `threadgraph_render_graph`
- UI bridge: MCP Apps `ui/*` and `tools/call` JSON-RPC over `postMessage`
- UI state: local relation-kind and evidence-class filters
- Authoritative state: MCP tool results only
- Map limit: 80 nodes and 200 relations
- Accessible list limit: 250 nodes and 500 relations

## Performance fixture

- Synthetic nodes: 5,000
- Synthetic relations: 10,000
- Full-view target: at most 250 ms
- Filtered-view target: at most 100 ms
- Heap delta target: at most 64 MiB
- Serialized view target: at most 5 MiB
- UI resource target: at most 100 KiB

## Observed result

Date: 2026-09-04. Bundled Node runtime on the local Codex macOS host.

| Measurement | Target | Observed | Result |
| --- | ---: | ---: | --- |
| Full view | ≤ 250 ms | 20.671 ms | Pass |
| Contradiction + inferred filter | ≤ 100 ms | 6.957 ms | Pass |
| Heap delta | ≤ 64 MiB | 5,997,632 bytes | Pass |
| Serialized view | ≤ 5 MiB | 2,400,679 bytes | Pass |
| UI resource | ≤ 100 KiB | 10,301 bytes | Pass |

The filtered view contained 882 nodes and 666 relations before UI rendering limits.

## Privacy result

- email sentinel absent from the view;
- token sentinel absent from the view;
- native thread identity absent from UI nodes;
- graph labels capped at 160 characters;
- Source Envelopes, observations, and evidence payloads absent from render-tool output;
- local Registry, WAL, SHM, and migration backup permissions forced to owner-only on POSIX hosts.

Version 0.1 does not claim application-level database encryption. It relies on operating-system account isolation and volume encryption while additionally enforcing owner-only file permissions. This limitation is explicit rather than hidden behind an unsupported encryption claim.

## Remaining validation

The source and direct MCP smoke tests prove packaging shape and runtime behavior. A newly opened Codex task must still prove that the installed desktop host discovers and renders the resource through its own MCP Apps container.
