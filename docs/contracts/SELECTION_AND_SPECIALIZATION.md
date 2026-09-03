# Selection and specialization contract

## Goal query

A Goal Query records the user's objective, scope revision, requested project boundary, required topics or constraints, observation cutoff, and query digest. It reads one already published Graph Revision. It cannot refresh the index, resume a thread, or create a thread.

When no published revision exists, the outcome is `incomplete` with `nextAction=open_project_graph`. When the selected revision is stale, the report preserves that revision and returns `nextAction=refresh_project_graph` without performing the refresh.

## Eligibility gate

A thread is eligible only when:

- it is inside the authorized scope;
- its native identity is known;
- required evidence is readable or the gap is explicitly acceptable;
- it is not confirmed deleted or superseded for the relevant purpose;
- known project and lineage constraints do not conflict with the query.

Active writer state, stale evidence, and unresolved conflicts do not always make a thread ineligible, but they must be surfaced before navigation or reuse.

## Ranking dimensions

- goal relevance;
- explicit decision and constraint coverage;
- evidence and activity freshness at the query cutoff;
- lineage and explicit-reference continuity relative to the query anchor;
- demonstrated artifact or validation history;
- unresolved conflict penalty;
- missing-context penalty;
- user-confirmed specialization match.

Project membership is an eligibility gate in the first implementation, not a score. Native accessibility and active-writer state determine navigation or reuse next actions but do not lower a thread's context-quality score.

The product must expose dimensions and evidence rather than only one opaque score.

## Selection outcomes

- `recommended`: one candidate is materially better and no blocking conflict is hidden;
- `ambiguous`: multiple candidates have meaningful tradeoffs;
- `no_suitable_candidate`: every candidate fails eligibility or lacks required evidence;
- `incomplete`: source access failed before a safe comparison was possible.

Each Selection Report is immutable and records candidate thread IDs, dimension values, evidence references, conflicts, missing evidence, result, and graph revision.

## Specialization lifecycle

Specialization states are `suggested`, `confirmed`, `rejected`, and `superseded`.

- A suggested label requires repeated supporting evidence across distinct Turns or artifacts; one incidental mention is insufficient.
- A confirmed label requires explicit user acceptance and records the accepting origin.
- Rejection prevents the same evidence revision from suggesting the label again.
- New evidence may produce a new suggestion revision but cannot silently replace a confirmed label.
- Specialization describes demonstrated context; it does not grant tools, sandbox, network, filesystem, or execution authority.

## Navigation

Selecting a recommendation may navigate to the native thread only after an explicit user action. Navigation sends no prompt and starts no Turn.
