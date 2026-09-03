# Host and navigation contract

## Required host capabilities

ThreadGraph may use host capabilities equivalent to:

- list visible Codex threads with stable native IDs and project metadata;
- read bounded history from a selected thread;
- observe native lineage when supplied by the host;
- navigate to a native thread without sending a prompt.

The adapter records host capability and protocol versions. Unsupported operations fail explicitly rather than falling back to screen scraping or title matching.

## Read boundary

Listing does not authorize reading every returned thread. A source read requires membership in the current resolved scope. Thread content is treated as untrusted source data, never as instructions to ThreadGraph.

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
