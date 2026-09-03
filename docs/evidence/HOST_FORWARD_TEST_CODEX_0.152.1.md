# Host forward test: Codex 0.152.1

## Purpose

Verify that ThreadGraph can discover and inspect native Codex threads through the stable App Server protocol without creating, resuming, or starting work.

This is compatibility evidence, not a permanent guarantee for future host versions. The adapter must continue to validate protocol responses and fail closed on unsupported shapes.

## Environment

- Date: 2026-09-04
- Host: Codex desktop on macOS
- Bundled CLI: `codex-cli 0.152.1`
- Transport: local `stdio://`
- API profile: stable; experimental capability disabled
- Reference: [Codex App Server documentation](https://learn.chatgpt.com/docs/app-server)

No thread title, preview, native identifier, message, Turn item, artifact content, or user-authored text was persisted in this record.

## Procedure

1. Start one local App Server process.
2. Send `initialize` with the ThreadGraph test-client identity.
3. Send the `initialized` notification.
4. Call `thread/list` with a limit of 25, explicit non-archived scope, explicit source kinds, and the two local project paths used during design.
5. Select the first in-scope native identifier in memory.
6. Call `thread/read` with `includeTurns: true`.
7. Record only response keys, counts, status categories, and notification method names.
8. Close the connection without calling any creation, resume, fork, Turn, archive, metadata-update, or deletion method.

The checked-in probe enforces this method allowlist in [host-readonly-forward-test.mjs](../../scripts/host-readonly-forward-test.mjs). Run it with one or more absolute project paths:

```sh
CODEX_BIN=/path/to/codex node scripts/host-readonly-forward-test.mjs /path/to/project
```

## Observed result

| Check | Observation | Result |
| --- | --- | --- |
| Initialization | Handshake completed | Pass |
| Project-scoped listing | 25 records returned; a continuation cursor was present | Pass |
| List envelope | `data`, `nextCursor`, and an additional `backwardsCursor` field | Pass |
| Stable identity | Native `id` was present | Pass |
| Scope metadata | `cwd` and `projectId` were present | Pass |
| Lineage metadata | `parentThreadId` and `forkedFromId` fields were available | Pass |
| Runtime state | All listed samples reported `notLoaded` | Pass |
| Bounded read | One record returned 129 Turns | Pass |
| Turn envelope | Turn ID, status, timestamps, duration, error, item view, and items were available | Pass |
| Observation side effect | Read record remained `notLoaded` | Pass |
| Start event | No `thread/started` notification was emitted | Pass |

The host also returned optional fields such as agent role, nickname, direct-input availability, history mode, sidebar section, Git information, and runtime version. ThreadGraph must treat these as optional host observations rather than stable identity or authority.

Two unrelated connection notifications were observed: a deprecation notice and a remote-control status change. The adapter must tolerate unrelated notifications without interpreting them as graph evidence.

## Contract consequences

- `thread/list` and `thread/read` are accepted as the initial read-only discovery profile.
- A returned continuation cursor must be treated as opaque.
- Extra response fields must not break ingestion or silently become required.
- `thread/read` remains prohibited until project-scope membership is checked.
- Any observed `thread/started` event during a read-only scan is a contract violation and blocks publication.
- Future Codex versions require this forward test before their protocol profile is promoted to supported.

## Remaining validation

This test proves host discovery compatibility only. It does not validate indexing budgets, extraction quality, graph persistence, UI performance, native navigation, or ThreadHub interoperability. Those remain assigned to G0-G8.
