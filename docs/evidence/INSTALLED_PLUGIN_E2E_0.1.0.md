# Installed plugin E2E: 0.1.0

## Purpose

Verify that the plugin package installed through the personal marketplace exposes the expected MCP surface and can complete a real, read-only Codex indexing session from its installed cache location.

This record covers the installed runtime cache. Codex desktop discovery in a newly opened task remains a separate user-visible release check because the current task does not reload newly installed plugin capabilities.

## Environment

- Date: 2026-09-04
- Host: Codex desktop on macOS
- Plugin manifest version: `0.1.0+codex.20260904073659`
- Installed cache: personal marketplace
- Registry: isolated temporary SQLite database
- Native source: local Codex App Server over `stdio://`

No source text, thread title, native identifier, message, Turn item, or artifact content is persisted in this record.

## Procedure

1. Compare the installed manifest, MCP configuration, launcher, server, and package metadata with the reviewed source tree.
2. Start the MCP server from the installed cache using the bundled Codex Node runtime.
3. Complete the MCP handshake and verify the exact six-tool surface.
4. Prepare an initial index for a project with existing Codex tasks.
5. Return valid empty Extraction Envelopes for every detailed source. This exercises the transport and publication contracts without inventing semantic claims.
6. Publish the session and query the resulting graph.
7. Record only counts, states, and version information, then discard the temporary Registry.

## Observed result

| Check | Observation | Result |
| --- | --- | --- |
| Installed-file parity | Manifest, MCP configuration, launcher, server, and package metadata matched reviewed source digests | Pass |
| Launcher permissions | Installed launcher was executable | Pass |
| MCP initialization | Installed server completed the handshake with no stderr output | Pass |
| Tool discovery | All six expected tools were returned in the frozen order | Pass |
| Scoped enumeration | 100 in-scope tasks were bounded by the indexing policy | Pass |
| Detailed reads | 12 semantic sources were returned; 88 sources remained metadata-only | Pass |
| Session state | `prepared` | Pass |
| Atomic publication | `published` | Pass |
| Graph availability | `ready` | Pass |
| Materialized graph | 89 thread nodes and 89 observed relations | Pass |
| Semantic restraint | No inferred relation was created from empty extractions | Pass |

The discovered tool surface was:

- `threadgraph_get_graph`
- `threadgraph_inspect_evidence`
- `threadgraph_select_thread`
- `threadgraph_prepare_index`
- `threadgraph_publish_index`
- `threadgraph_cancel_index`

## Contract consequences

- The marketplace package now connects its MCP server through the plugin manifest.
- The installed cache, rather than only the source checkout, can execute the full prepare, publish, and graph-query path.
- Real task discovery remains bounded and read-only; semantic publication requires one Extraction Envelope per detailed source.
- Empty extractions do not manufacture semantic relationships.
- A newly opened Codex task must still prove that the desktop host discovers these installed tools without a manual server launch.

## Remaining validation

- Open a new Codex task after installation or restart and confirm that the six ThreadGraph tools are available to the model.
- Run one user-visible initial graph open and inspect the graph surface.
- Complete the held-out G5/G6 calibration and large-scope G7 performance gates.
- Run the independent ThreadHub Context Pack consumer test.
