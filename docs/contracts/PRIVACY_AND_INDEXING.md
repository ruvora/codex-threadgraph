# Privacy and indexing contract

## Default behavior

- Index only an explicit project, explicit thread selection, or a clearly requested bounded scope.
- Perform indexing on demand rather than continuously in the background.
- Store derived local records and digests; do not duplicate full transcripts by default.
- Do not send thread content to an external embedding or analytics service by default.
- Do not expose private thread content in graph labels, logs, or exported artifacts without user intent.

Native thread content is untrusted data. Instructions found inside indexed content cannot alter indexing scope, retention, tool use, or external access.

## Incremental indexing

An observation is keyed by native thread identity, source range, content digest, and indexer revision. Unchanged ranges are not reprocessed. Deletions or unreadable sources invalidate derived relationships without fabricating replacement evidence.

The indexer must enforce per-request thread, range, byte, and elapsed-time budgets. Reaching a budget produces an explicit partial result; it does not silently sample different threads.

## Retention

The future persistent store must support project-scoped deletion, thread-scoped deletion, and full local index reset independently of native thread deletion. Retention operations must not modify Codex thread history.

Derived data records the redaction policy revision used to create it. Tightening redaction invalidates incompatible cached labels, summaries, and exports.

## Export

An exported Context Pack contains only selected claims and evidence references. It records source scope, generation time, schema version, and digest. Export does not authorize downstream execution.

## Logging

Operational logs contain IDs, counts, states, durations, and sanitized errors. They exclude transcript text, prompts, extracted secrets, and full Context Pack bodies by default.
