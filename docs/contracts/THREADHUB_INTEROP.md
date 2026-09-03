# ThreadHub interoperability contract

## Independence

ThreadGraph and ThreadHub have separate processes, databases, schemas, release cycles, and failure domains. Neither plugin imports the other's private storage or assumes it is installed.

## Context Pack

The only planned knowledge handoff is a versioned Context Pack containing:

- schema version and pack ID;
- ThreadGraph build identity;
- source scope and graph revision;
- selected claim and evidence IDs;
- concise derived content necessary for the stated purpose;
- unresolved conflicts and missing sources;
- observation cutoff and generation time;
- content digest.

The pack excludes execution permissions, sandbox policy, side-effect authorization, claim tokens, leases, and automatic Start instructions.

## Consumer validation

ThreadHub may accept, reject, or partially use a pack only after validating version, digest, source identity, scope, freshness, and conflicts. Imported context remains provenance, not authority. ThreadHub's own Context Snapshot and execution-contract gates remain authoritative.

## Failure isolation

- ThreadGraph unavailability does not stop ThreadHub from operating without graph context.
- ThreadHub unavailability does not stop local graph exploration.
- A rejected pack does not mutate either graph or execution state.
- Retrying export is idempotent for the same graph revision and selection.

## Future actions

Any feature that dispatches work from ThreadGraph must cross an explicit user authorization boundary into ThreadHub. It cannot be introduced as a graph-node click or recommendation side effect.
