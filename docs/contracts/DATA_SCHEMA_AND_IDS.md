# Data schema and identity contract

## ID encoding

Externally visible IDs use a type prefix plus base32-encoded SHA-256 or UUIDv7 value. Hash inputs use UTF-8, length-prefixed fields, and an explicit schema namespace.

For `id-policy/1-alpha`, each hash component is framed as eight lowercase hexadecimal digits containing its UTF-8 byte length, followed by `:`, followed by the original UTF-8 bytes. The input is the concatenation of the framed namespace and each framed field in contract order. Hashed IDs encode the 32-byte SHA-256 result using lowercase RFC 4648 base32 without padding. Source digests use the same framing and lowercase hexadecimal output prefixed by `sha256:`. Mutable labels, absent optional fields, and presentation order never enter an identity hash unless an entity rule explicitly includes them.

Content-addressed ID namespaces use `codex-threadgraph/<entity>-id/1`, where `<entity>` is the lower-case entity name from the ID table with spaces replaced by hyphens. The bounded source digest namespace is `codex-threadgraph/source-digest/1`. A namespace change is a schema migration and produces different IDs; it is never introduced silently.

Example thread input:

```text
namespace = codex-threadgraph/thread-id/1
fields    = [host-local, native-123]
id        = thr_ptb37vxwbn6pfjteocmhhn5fdmzfg7ilunakyokctdozld5mzrha
```

| Entity | ID rule |
|---|---|
| Project | `prj_` + hash of host identity and canonical project identity |
| Source Thread | `thr_` + hash of host identity and native thread ID |
| Observation | `obs_` + hash of thread ID, source range, content digest, redaction version |
| Evidence Item | `evd_` + hash of observation ID, item locator, bounded content digest |
| Claim | `clm_` + hash of claim kind, canonical subject ID, normalized predicate and object, evidence digest, extractor version |
| Semantic Entity | `ent_` + UUIDv7 assigned when the entity is first accepted |
| Node Revision | `nrv_` + hash of logical node ID, evidence digest, attributes digest, lifecycle, schema policy |
| Logical Relation | `rel_` + hash of scope, source ID, target ID, relation kind |
| Relation Revision | `rlv_` + hash of logical relation, evidence digest, policy version, lifecycle |
| Graph Revision | `grv_` + hash of scope, parent revision, observation cutoff, policies, sorted current node/edge revision IDs |
| Goal Query | `qry_` + hash of graph revision, normalized goal, requirements, query policy |
| Selection Report | `sel_` + hash of query ID, candidate vector digest, selection policy |
| Export | `ctx_` + hash of graph revision, selected claim/evidence IDs, stated purpose, export policy |

Graph nodes use these logical identity kinds: `project` → Project ID, `thread` → Thread ID, `topic` → Semantic Entity ID, and `decision`, `constraint`, `artifact`, and `result` → Claim ID. The node kind and ID prefix must agree; a merely well-formed ID from another kind is rejected.

Semantic entity nodes receive UUIDv7 IDs when first accepted. Their labels and aliases are mutable revisions, so they are not content-addressed.

Canonical project identity uses host-supplied saved-project identity when available. Otherwise a Git workspace uses the real path of its common Git directory so managed worktrees converge; a non-Git workspace uses its canonical real path. These identities are local and are not exported as globally portable project authority.

## Source Thread record

Required fields:

- `id`, `hostId`, `nativeThreadId`, `projectId`;
- native title and source-provided summary as mutable attributes;
- created, updated, observed timestamps;
- native status and accessibility state;
- exact parent thread ID when supplied;
- coverage: `metadata_only`, `summary_indexed`, `turn_indexed`, `partial`, or `unreadable`;
- current observation and profile revision IDs.

## Claim record

```json
{
  "id": "clm_…",
  "kind": "decision",
  "subjectId": "ent_…",
  "predicate": "adopts",
  "object": { "type": "text", "value": "managed worktree integration" },
  "polarity": "affirm",
  "modality": "asserted",
  "lifecycle": "active",
  "validTime": { "from": null, "to": null },
  "evidenceIds": ["evd_…"],
  "extractorVersion": "extractor/1-alpha"
}
```

Allowed `kind`: `topic`, `decision`, `constraint`, `artifact`, `result`. Allowed `modality`: `asserted`, `proposed`, `questioned`, `rejected`. Proposed and questioned claims cannot become active decisions or constraints.

## Subject normalization

Normalization produces candidate aliases, not automatic semantic identity:

1. Unicode NFKC;
2. trim and collapse whitespace;
3. case-fold where the domain is case-insensitive;
4. preserve code identifiers, paths, versions, and quoted names exactly;
5. remove punctuation only when it is not semantically meaningful;
6. attach language and entity-kind hints.

Automatic merge is allowed only for exact normalized aliases within the same entity kind and project scope, or for an explicit alias stated in evidence. Acronyms, translations, similar embeddings, and model judgments create merge candidates requiring validation. Ambiguous candidates remain separate.

Entity merge is reversible. A merge revision records source entities, evidence, resolver version, and redirect; it never destroys prior IDs.

## Artifact identity

A repository artifact has two identities:

- logical artifact: canonical project ID plus normalized repository-relative path;
- artifact revision: logical artifact ID plus Git blob ID or content digest and observed commit or workspace revision.

Managed worktrees use the common Git project identity, so the same relative path converges to one logical artifact while retaining distinct revisions. Renames require explicit Git rename evidence or an accepted alias; similar names do not merge automatically.

An artifact outside a repository uses its declared artifact kind, source thread, bounded locator, and content digest. A URL is an external reference unless content identity is actually observed.

## Goal Query record

A Goal Query stores the original goal digest and a validated requirement vector. Each requirement records source span, canonical subject candidate, kind, importance (`required`, `preferred`, or `contextual`), ambiguity, and query-extractor version. Selection is deterministic from the accepted requirement vector and Graph Revision; model prose outside the vector is ignored.

## Relation record

```json
{
  "relationKey": "rel_…",
  "revisionId": "rlv_…",
  "sourceId": "thr_…",
  "targetId": "ent_…",
  "kind": "references",
  "evidenceClass": "extracted",
  "evidenceIds": ["evd_…"],
  "confidenceBand": null,
  "strength": null,
  "policyVersion": "relation-policy/1-alpha",
  "lifecycle": "current"
}
```

`relationKey` identifies the logical source-target-kind tuple. `revisionId` also includes evidence, confidence, policy, and lifecycle. New evidence creates a new relation revision without overwriting history.

Node and Relation Revision IDs are computed before the containing Graph Revision. The published projection adds `includedInRevisionId` after the Graph Revision ID is computed. This containment field is verified against the enclosing revision and is not used as an input to its own child revision ID, avoiding a circular hash dependency.

Observation and Evidence Item IDs are recomputed from their provenance before publication. A correctly shaped `obs_` or `evd_` string is not sufficient when its hash does not match the bounded source range, digest, redaction version, observation, or item locator.

## Null and unknown

Unknown, unavailable, redacted, and not applicable are distinct. Missing optional data is `null` only when the schema defines its meaning. Unknown values never receive fabricated defaults and cannot contribute positive ranking evidence.
