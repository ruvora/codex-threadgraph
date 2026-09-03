# ADR-002: Keep ThreadGraph independent and read-only

Status: Accepted

## Decision

ThreadGraph has a separate process, schema, and Registry from ThreadHub. Its initial capabilities list and read bounded thread context, derive local graph data, explain recommendations, and navigate without sending prompts.

## Rationale

Knowledge exploration and execution orchestration have different authority and failure modes. Combining them would allow an inference or graph click to accidentally become execution authority and would couple releases and recovery.

## Consequences

- ThreadGraph remains useful without ThreadHub.
- No shared database or private module import is allowed.
- Future integration uses a versioned Context Pack and explicit user authorization at the ThreadHub boundary.
- Mutating thread identity or accepting persistent specialization requires a future contract rather than incidental UI behavior.
