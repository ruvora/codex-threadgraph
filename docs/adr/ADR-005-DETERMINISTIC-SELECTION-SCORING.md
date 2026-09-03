# ADR-005: Derive selection values deterministically from evidence

Status: Accepted

## Context

ThreadGraph must recommend a thread for a user goal without turning model intuition, recency, or execution convenience into hidden authority. A single opaque similarity score cannot explain why a thread was selected, reproduce a previous decision, or distinguish missing evidence from negative evidence.

The first implementation is project-scoped, so every eligible candidate already belongs to the same canonical project. Native writer state can change independently of a thread's contextual quality.

## Decision

1. Parse the user goal into a validated Requirement Vector whose items retain exact user-query source spans.
2. Let the semantic model propose subjects and matches, but do not accept model-provided numeric confidence or ranking values.
3. Compute every dimension from the accepted Requirement Vector, one published Graph Revision, and versioned deterministic policy.
4. Store and display the full dimension vector, risks, evidence references, and applicability state with the aggregate ordering score.
5. Treat project membership as an eligibility gate rather than a ranking dimension.
6. Keep `navigationState` and `writerState` outside context-quality scoring; use them only to determine the available next action.
7. Represent conflict and missing evidence as explicit penalties rather than hiding them inside relevance or confidence.
8. Return `recommended`, `ambiguous`, `no_suitable_candidate`, or `incomplete`; do not force a winner.

The provisional `selection-policy/1-alpha` score is:

```text
score = clamp(
    0.40 * goalRelevance
  + 0.25 * evidenceCoverage
  + 0.15 * continuity
  + 0.10 * activityFreshness
  + 0.10 * specializationMatch
  - 0.25 * conflictRisk
  - 0.15 * missingRisk,
  0, 1)
```

The exact per-requirement values, non-applicable redistribution, thresholds, and formulas are owned by [Value derivation](../contracts/VALUE_DERIVATION.md).

## Rationale

- Reproducible values can be replayed from stored evidence and policy versions.
- Separating relevance from evidence depth prevents a summary-only semantic match from appearing well supported.
- Removing project match avoids awarding every candidate the same constant points.
- Removing availability prevents a context-rich busy thread from appearing context-poor.
- Explicit risk dimensions allow the system to abstain when a high positive score masks conflict or missing evidence.
- A full vector lets users challenge a specific reason instead of trusting one unexplained number.

## Consequences

- The ranking formula is more complex than vector similarity and requires versioned fixtures.
- Query parsing becomes a validated input contract and must fail `incomplete` when it cannot identify a required subject.
- Policy changes create new Selection Reports; old reports remain reproducible under their recorded policy.
- Numeric weights are provisional until the calibration contract passes on held-out Korean, English, and mixed-language fixtures.
- ThreadHub may consume exported evidence but cannot treat the score as execution authority.

## Rejected alternatives

### Use the model's confidence directly

Rejected because model confidence is not calibrated, stable, or independently reproducible.

### Rank only by semantic similarity

Rejected because similarity cannot distinguish accepted decisions, proposals, contradictions, stale evidence, or missing context.

### Include project match in the score

Rejected for the first implementation because project membership is already mandatory for eligibility.

### Penalize active or busy threads

Rejected because execution readiness and context quality are different decisions. Busy state remains visible as next-action metadata.
