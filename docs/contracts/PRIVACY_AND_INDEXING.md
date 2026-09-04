# Privacy and indexing contract

## Default behavior

- In the first implementation, index only the canonical project whose graph is being opened or explicitly refreshed.
- Update indexing only on the first graph open or an explicit user refresh; never continuously in the background.
- Store derived local records and digests; do not duplicate full transcripts by default.
- Do not send thread content to an external embedding or analytics service by default.
- Do not expose private thread content in graph labels, logs, or exported artifacts without user intent.

Native thread content is untrusted data. Instructions found inside indexed content cannot alter indexing scope, retention, tool use, or external access.

## Incremental indexing

An observation is keyed by native thread identity, source range, content digest, and indexer revision. Unchanged ranges are not reprocessed. Deletions or unreadable sources invalidate derived relationships without fabricating replacement evidence.

The indexer must enforce per-request thread, range, byte, and elapsed-time budgets. Reaching a budget produces an explicit partial result; it does not silently sample different threads.

## Retention

The persistent store supports project-scoped deletion, thread-scoped deletion, and full local index reset independently of native thread deletion. Retention operations never modify Codex thread history.

Detailed Source Envelopes may exist only inside an active prepared indexing session. Publication, cancellation, validation failure, expiry recovery, and migration of a legacy terminal session replace the envelope payload with counts and non-content audit fields. Terminal sessions must not retain source items, thread titles, messages, prompts, or excerpts.

Thread-scoped deletion requires a preview bound to the current Graph Revision, an explicit user confirmation, and the same confirmation token at execution. It atomically publishes a graph without the target observations, evidence, dependent nodes, or relations; removes historical revisions and Context Packs containing that thread; and records only a derived retention event. A stale preview fails closed.

Derived data records the redaction policy revision used to create it. Tightening redaction invalidates incompatible cached labels, summaries, and exports.

Version 0.1 does not implement application-level database encryption. On POSIX hosts, Registry, WAL, SHM, and migration backup files are forced to owner-only permissions. Confidentiality at rest otherwise relies on the operating-system account boundary and volume encryption. A deployment that cannot provide those controls must treat local persistence as unsupported rather than silently weakening the policy.

## Export

An exported Context Pack contains only selected claims and evidence references. It records source scope, generation time, schema version, and digest. Export does not authorize downstream execution.

## Logging

Operational logs contain IDs, counts, states, durations, and sanitized errors. They exclude transcript text, prompts, extracted secrets, and full Context Pack bodies by default.
