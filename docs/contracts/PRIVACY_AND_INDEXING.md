# Privacy and indexing contract

## Default behavior

- Index only an explicit project, explicit thread selection, or a clearly requested bounded scope.
- Perform indexing on demand rather than continuously in the background.
- Store derived local records and digests; do not duplicate full transcripts by default.
- Do not send thread content to an external embedding or analytics service by default.
- Do not expose private thread content in graph labels, logs, or exported artifacts without user intent.

## Incremental indexing

An observation is keyed by native thread identity, source range, content digest, and indexer revision. Unchanged ranges are not reprocessed. Deletions or unreadable sources invalidate derived relationships without fabricating replacement evidence.

## Retention

The future persistent store must support project-scoped deletion, thread-scoped deletion, and full local index reset independently of native thread deletion. Retention operations must not modify Codex thread history.

## Export

An exported Context Pack contains only selected claims and evidence references. It records source scope, generation time, schema version, and digest. Export does not authorize downstream execution.
