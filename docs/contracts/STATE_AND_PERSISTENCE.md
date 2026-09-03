# State and persistence contract

## Storage ownership

One local ThreadGraph service owns a versioned SQLite Graph Registry. It never opens or writes the ThreadHub Registry. Native Codex threads remain owned by Codex Desktop and App Server.

## Durable entities

- scopes and scope revisions;
- source threads and lineage references;
- observations and source digests;
- evidence items and claims;
- graph revisions, nodes, edges, and invalidations;
- thread profiles and specialization revisions;
- goal queries and selection reports;
- export manifests and Context Pack digests;
- indexing jobs, leases, and failure records.

Full transcripts are not durable entities by default.

Every indexing job records `triggerKind` as `initial_graph_open` or `explicit_refresh`. No other trigger value is supported in the first schema version. Restart recovery may continue the same previously authorized job but cannot create a new refresh request.

## State machines

### Index job

```text
queued -> reading -> extracting -> linking -> validating -> published
   |         |           |          |           |
   +---------+-----------+----------+-----------+-> failed
   +------------------------------------------------> cancelled
```

`published`, `failed`, and `cancelled` are terminal. A retry creates a new job attempt linked to the same immutable request, and only transient host or storage failures may reuse unchanged input.

### Source availability

```text
unknown -> readable -> stale
   |          |          |
   +----------+----------+-> unreadable
   +----------+----------+-> missing -> deleted
```

`deleted` requires host confirmation. `missing` and `unreadable` do not imply deletion.

### Relation lifecycle

```text
candidate -> current -> superseded
    |           |
    +-----------+-> invalidated
    +--------------> rejected
```

Only `current` relations appear in the default graph. Historical revisions remain auditable.

## Atomicity

- An indexing job publishes all nodes, edges, invalidations, and the current revision pointer in one transaction.
- A failed job cannot partially update the current graph.
- Specialization acceptance and rejection are immutable revisions.
- A Selection Report references one exact published graph revision.
- Export records are committed before a Context Pack is returned.

## Concurrency

Only one writer lease may publish a given scope at a time. Reads use a published revision and never observe a building revision. Stale workers are fenced by `worker_id + lease_token + generation`.

## Migration and backup

The Registry carries a schema version. A migration requires a backup, transactional upgrade, post-migration integrity check, and reopen test. Failed migrations restore the previous database without advancing the schema version.

## Recovery

On restart:

- a job before publication is marked interrupted and may be retried only under retry policy;
- a committed revision with a stale pointer is finalized idempotently;
- expired writer leases are released;
- no native thread is reread until scope and host access are revalidated;
- no prior inferred relation is silently promoted because of recovery.
