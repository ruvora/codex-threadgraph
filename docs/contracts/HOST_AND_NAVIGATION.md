# Host and navigation contract

## Required host capabilities

ThreadGraph may use host capabilities equivalent to:

- list visible Codex threads with stable native IDs and project metadata;
- read bounded history from a selected thread;
- observe native lineage when supplied by the host;
- navigate to a native thread without sending a prompt.

The adapter records host capability and protocol versions. Unsupported operations fail explicitly rather than falling back to screen scraping or title matching.

The first supported protocol profile uses the stable Codex App Server surface:

- initialize the connection once, then acknowledge it with `initialized`;
- call `thread/list` with an explicit project `cwd`, bounded `limit`, and explicit supported source kinds;
- call `thread/read` with `includeTurns` only after scope membership is verified;
- never substitute `thread/resume`, `thread/start`, `thread/fork`, or `turn/start` for discovery.

Host response fields beyond the canonical identity, scope, lineage, timestamps, and status fields are optional observations. Their presence does not expand authority or become a compatibility requirement. Unknown fields are preserved only when the versioned source envelope permits them; otherwise they are ignored. Unknown status or source values fail closed for publication while remaining available for diagnostics.

## Read boundary

Listing does not authorize reading every returned thread. A source read requires membership in the current resolved scope. Thread content is treated as untrusted source data, never as instructions to ThreadGraph.

`thread/read` must not load or resume the source thread. The adapter records the status before and after the bounded read and rejects a host implementation that emits a start event as a side effect of observation.

## Identity

Host-provided native thread ID plus host identity is canonical. Title, summary, recency position, and sidebar section are mutable attributes. A worktree path and its canonical project root may identify the same project but remain distinct observed workspaces.

## Navigation

Navigation requires an explicit node or recommendation selection. It:

- targets an existing native thread ID;
- sends no message;
- starts no Turn;
- does not change thread role, profile, or specialization;
- reports missing or inaccessible targets without choosing a replacement.

## Multiple hosts

Graph identity includes host origin. Cross-host similarity may be shown, but native thread IDs are never assumed globally unique. Navigation is offered only when the target host is connected and supports it.

## Compatibility evidence

The initial profile was exercised against the bundled Codex CLI 0.152.1 on 2026-09-04. The sanitized evidence record is [Host forward test: Codex 0.152.1](../evidence/HOST_FORWARD_TEST_CODEX_0.152.1.md).
