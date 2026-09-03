# Worked graph generation example

This example uses simplified evidence to show how semantic candidates become deterministic graph values.

## Source threads

| Thread | Evidence |
|---|---|
| A — Authentication architecture | User focuses the thread on authentication; adopts JWT sessions; requires no external identity provider; produces `docs/auth.md`; two substantive Turns |
| B — Authentication tests | References the JWT decision; validates `docs/auth.md`; records a passing authentication test result; two substantive Turns |
| C — OAuth exploration | Discusses authentication and proposes an external OAuth provider; no accepted decision or artifact |

All sources are current and observed today, so activity and evidence recency equal `1.0` for this example.

## Exact skeleton

The host adapter creates three Source Thread nodes and three `belongs_to` edges. If B was natively forked from A, it also creates an exact `B -> A forked_from` edge. Titles do not participate in the IDs.

## Extraction

The semantic extractor proposes:

```text
A: topic(authentication)
A: decision(authentication.session, adopts, JWT, asserted, active)
A: constraint(authentication.identity_provider, prohibits, external, asserted, active)
A: artifact(docs/auth.md, produced)
B: topic(authentication)
B: decision reference(authentication.session, JWT)
B: artifact(docs/auth.md, validated)
B: result(authentication tests, passing)
C: topic(authentication)
C: decision(authentication.identity_provider, adopts, OAuth, proposed)
```

The validator keeps C's modality as `proposed`; it cannot become an active decision or automatically contradict A's active constraint.

## Subject resolution

The exact path `docs/auth.md` resolves A's produced artifact and B's validated artifact to one artifact entity. Authentication topic labels normalize to one candidate subject. `external identity provider` and `OAuth` remain separate until explicit alias or semantic-resolution evidence exists.

## Topic values

For A's authentication topic:

```text
support = 4 * 1 explicit user focus
        + 3 * 1 produced artifact
        + 2 * 1 active decision
        + 2 substantive Turns
        = 11

topicWeight = log2(1 + 11) * 1.0 = 3.585
```

For B, one validated result and two substantive Turns produce support `4`, so its simplified topic weight is `log2(5) = 2.322`.

C has only one substantive proposed exploration. It can receive topic evidence but cannot receive a confirmed specialization from that evidence.

## Thread relationship

A and B share:

- the same artifact identity: 3 points;
- the active JWT decision subject: 3 points;
- the authentication topic: 1 point.

Total relation strength is `7` across three evidence categories, so `A related_to B` is `strong`. If native fork lineage exists, the exact `forked_from` relation is displayed separately and carries no inferred confidence.

A and C share only a topic: `1` point, so their relatedness is `weak`. C's OAuth proposal may create a contradiction candidate for inspection, but it is not published as a current contradiction because subject identity and active modality requirements are not satisfied.

## Specialization

A has topic support `11`, at least two independent Turns or artifacts, and evidence stronger than a host summary. The graph may publish `authentication` as a `suggested` specialization. It remains unconfirmed until the user explicitly accepts it.

## Goal selection

Goal: “Continue implementing and validating authentication tests.”

Example dimension vectors:

| Thread | Relevance | Evidence | Continuity | Freshness | Specialization | Conflict | Missing |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 0.75 | 0.90 | 0.80 | 1.00 | 0.70 | 0.00 | 0.00 |
| B | 0.95 | 0.85 | 0.90 | 1.00 | 0.80 | 0.00 | 0.00 |
| C | 0.45 | 0.50 | 0.30 | 1.00 | 0.30 | 0.20 | 0.20 |

Applying `selection-policy/1-alpha` gives:

```text
A = 0.815
B = 0.908
C = 0.400
```

B is `recommended`: it exceeds `0.65`, leads A by `0.093`, has evidence coverage above `0.60`, and has no blocking conflict. The report still shows A as a strong alternative and explains every dimension. C's proposal is visible context but does not gain authority from the score.

## Revision publication

The publisher validates every evidence path, recomputes IDs and values, checks omitted counts, and commits nodes, edges, profiles, invalidations, and the current revision pointer in one transaction. Reopening the graph reads this revision without re-indexing. Only an explicit Refresh can incorporate later thread changes.
