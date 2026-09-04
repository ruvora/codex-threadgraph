# Independent ThreadHub consumer verification v1

Date: 2026-09-04  
Producer: Codex ThreadGraph `codex/release-gates`  
Consumer: [Codex ThreadHub PR #7](https://github.com/ruvora/codex-threadhub/pull/7)

## Boundary under test

ThreadGraph and ThreadHub use different repositories, processes, databases, schemas, and implementations. The consumer does not import ThreadGraph source or access the Graph Registry. A JSON fixture produced by ThreadGraph crosses the boundary.

The consumer independently implements canonical JSON, framed SHA-256 fingerprints, lowercase unpadded Base32 IDs, schema validation, source identity checks, explicit scope binding, freshness policy, conflict policy, and missing-source policy.

## Result

- A producer-generated `threadgraph-context-pack/1-alpha` fixture is accepted.
- Unsupported version, unknown field, forged digest, forged pack ID, untrusted producer, wrong scope, invalid time, stale observation, unresolved conflict, missing source, and nested authority fields fail before Registry mutation.
- Missing sources can be imported only with an explicit partial-import policy and remain warnings.
- An accepted import creates one project-scoped `candidate` claim and one provenance source.
- The imported claim has `observed_thread` authority, `provenanceOnly: true`, and `executionAuthority: false`.
- No Context Snapshot or execution entity is created.
- Repeating an identical import converges on the same claim and source.
- Changing any semantic pack content changes both `contentDigest` and `packId`.

## Automated evidence

ThreadHub:

- `test/threadgraph-context-pack.test.js`: four focused compatibility, rejection, idempotency, authority, and partial-import tests passed.
- `test/mcp-server.test.js`: the public `import_threadgraph_context_pack` tool binds the candidate to a ThreadHub project and creates no Context Snapshot.
- Full suite: 271 tests passed.
- Static syntax check passed.

ThreadGraph:

- `test/g8/context-pack.test.mjs`: four producer, validation, authority, failure, and export persistence tests passed.
- The producer and consumer fixture agree on the content digest and content-addressed pack ID without shared implementation code.

## Release meaning

G8 is complete at source level. This evidence does not claim that both plugins have been installed together in a newly restarted Codex Desktop task. That live installed-runtime check remains part of the final release E2E.
