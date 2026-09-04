# Indexing session contract

## Purpose

An indexing session is the only bridge between native source observation and Graph Revision publication. It changes only ThreadGraph's local Registry. It cannot start, resume, message, fork, archive, or otherwise mutate a Codex thread.

## Flow

```text
authorized initial_graph_open or explicit_refresh
  -> prepare_index
  -> freeze scope, cutoff, policies, budget, parent revision, and source digest
  -> return bounded Source Envelopes as untrusted data
  -> current Codex Turn creates strict Extraction Envelopes
  -> publish_index with the same session ID
  -> revalidate session fingerprint, source digest, lease, expiry, and host scope
  -> deterministically materialize evidence, nodes, exact relations, and bounded inference
  -> atomically publish the Graph Revision, session result, job result, and current pointer
```

`cancel_index` terminates a prepared session without publishing graph state.

## Durable identity

The session records:

- opaque session ID;
- immutable request fingerprint;
- canonical project and host identity;
- canonical absolute project path used only for the read-only host scope;
- authorized trigger and request origin;
- observation cutoff and parent Graph Revision;
- frozen policy and resource budget;
- ordered bounded Source Envelopes and their aggregate digest;
- job ID, writer identity, lease token, generation, and expiry;
- terminal result revision or structured failure.

The current Codex Turn receives source data and a session ID, not write authority over these frozen values.

## Validation rules

- only `initial_graph_open` and explicit `explicit_refresh` may prepare a session;
- `canonicalProjectId` and `canonicalProjectPath` are both required; the ID defines graph identity while the validated absolute path defines App Server scope;
- a native project ID used as a path, a relative path, a missing path, or a non-directory path fails before App Server creation;
- an initial open is rejected when a current revision already exists;
- every semantic Source Envelope requires exactly one matching Extraction Envelope;
- an Extraction Envelope from another session or unknown source digest is rejected;
- persisted request or source mutation is rejected by fingerprint recomputation;
- the canonical host scope is enumerated again immediately before publication;
- expired, cancelled, failed, interrupted, or already published sessions are terminal;
- graph IDs, evidence IDs, confidence bands, scores, and revision fingerprints are recomputed by deterministic code;
- validation failure releases the session lease and leaves the previous current revision unchanged.

## Atomic publication

Graph Revision insertion, current pointer advancement, session completion, job completion, and lease release occur in one SQLite transaction. A forced interruption exposes either the previous complete revision or the new complete revision, never a partial graph.

## Recovery

A process restart does not create a new indexing trigger. A prepared session may publish only while its original lease and expiry remain valid and host scope revalidation succeeds. A session interrupted during publication becomes `interrupted` and cannot be silently replayed.
