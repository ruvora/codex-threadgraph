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

The `threadgraph-context-pack/1-alpha` payload has one bounded derived field: `derivedContent.summary`. Unknown top-level fields, unknown derived-content fields, non-canonical timestamps, malformed collections, and nested authority-bearing keys are invalid.

`contentDigest` covers every semantic field except `packId` and `contentDigest`. `packId` covers the graph revision, selection digest, the complete `contentDigest`, and the ID-contract version. Consequently, changing derived content, conflicts, missing sources, producer identity, or observation times changes both the digest and pack ID.

## Consumer validation

ThreadHub may accept, reject, or partially use a pack only after independently validating version, schema, digest, content-addressed ID, source identity, explicitly bound scope, freshness, conflicts, missing sources, and forbidden authority fields. It does not import ThreadGraph hashing code or open the Graph Registry.

An accepted pack creates one project-scoped `candidate` claim with `observed_thread` authority and one `threadgraph_context_pack` provenance source. It does not activate the claim or create a Context Snapshot, routing decision, plan, Run, Task, Agent, Turn, lease, worktree, or execution contract. ThreadHub's own claim activation, Context Snapshot, planning, and execution-contract gates remain authoritative.

## Failure isolation

- ThreadGraph unavailability does not stop ThreadHub from operating without graph context.
- ThreadHub unavailability does not stop local graph exploration.
- A rejected pack does not mutate either graph or execution state.
- Retrying export is idempotent for the same graph revision and selection.
- A changed semantic payload receives a different `packId`, even when the selected claim and evidence IDs are unchanged.

Implementation evidence is recorded in [Independent ThreadHub consumer verification v1](../evidence/THREADHUB_CONSUMER_V1.md).

## Future actions

Any feature that dispatches work from ThreadGraph must cross an explicit user authorization boundary into ThreadHub. It cannot be introduced as a graph-node click or recommendation side effect.
