# Value derivation contract

Policy versions in this document are provisional `1-alpha` values and must be calibrated before their implementation gates exit.

The governing design decision is [ADR-005: deterministic selection scoring](../adr/ADR-005-DETERMINISTIC-SELECTION-SCORING.md).

## Evidence properties

Every supporting item carries separate properties:

- `authorityClass`: explicit user, native metadata, artifact or command, user content, assistant content, host summary, model inference;
- `traceability`: exact item, bounded range, summary only, or unresolved;
- `independenceKey`: source Turn or artifact identity used to count independent support;
- `observedAt` and source update marker;
- `redacted`: whether displayable source text was removed.

Authority is categorical and never averaged into confidence. Confidence describes support for an inference, not permission or truth.

## Freshness

Structural staleness is true when the host source update marker is later than the observation cutoff, the source becomes unreadable, or a redaction or extractor policy invalidates the observation.

Activity freshness is deterministic:

```text
activityFreshness = 2 ^ (-ageDays / 30)
```

`ageDays` is measured from the most recent substantive completed Turn at the frozen query cutoff. Title edits, dashboard views, indexing observations, and failed empty Turns do not reset activity age.

Evidence recency for ordinary topic and result evidence uses a 90-day half-life:

```text
evidenceRecency = 2 ^ (-ageDays / 90)
```

Explicit active decisions and constraints do not decay merely with time. They remain current until superseded, invalidated, contradicted, or made stale by a changed source. Recency affects ranking but never silently changes lifecycle.

## Topic weight

For a thread and canonical topic:

```text
support = 4 * explicitUserFocus
        + 3 * producedArtifactCount
        + 2 * activeDecisionCount
        + 2 * validatedResultCount
        + 1 * substantiveTurnCount

topicWeight = log2(1 + support) * evidenceRecency
```

Counts are deduplicated by `independenceKey`. Boilerplate, quoted context, and repeated summaries do not count as substantive Turns.

## Inference confidence bands

The initial version uses evidence rules rather than an uncalibrated model probability:

- `high`: at least two independent supporting source ranges, a concrete shared or conflicting subject, and no unresolved counter-evidence;
- `medium`: one direct range plus independent topic, artifact, or lineage corroboration;
- `low`: one source range, host-summary-only support, or unresolved plausible alternatives;
- `rejected`: missing evidence closure, semantic-rule failure, or stronger counter-evidence.

Numeric ordering values are `high=0.85`, `medium=0.65`, and `low=0.40`. The UI displays the band, not false decimal precision. Exact edges have no confidence value.

## Thread-to-thread relation strength

Evidence contributions under `relation-strength/1-alpha`:

| Evidence | Points |
|---|---:|
| Exact native lineage | 6 |
| Shared active decision | 3 |
| Same produced or validated artifact identity | 3 |
| Shared active constraint | 2 |
| Explicit cross-thread reference | 2 |
| Shared canonical topic | 1 |

Points are counted once per canonical evidence key. Strength is:

- `strong`: exact lineage, or at least 6 points from two evidence categories;
- `moderate`: at least 3 points when the strong rule is not satisfied;
- `weak`: 1–2 points;
- absent: 0 points.

Contradiction is a separate typed edge and risk dimension; it is not hidden by subtracting points from relatedness.

## Relation-specific gates

- `related_to`: at least one shared canonical evidence key and nonzero strength;
- `continues`: later observation plus exact lineage or explicit reference, and subject continuity;
- `contradicts`: same subject, incompatible predicate or polarity, overlapping validity, and at least extracted evidence on both sides;
- `supersedes`: explicit replacement evidence or accepted user resolution; never recency alone;
- `specializes_in`: specialization rule below;
- `produced` and `validated`: exact artifact or command-result evidence.

## Suggested specialization

A topic becomes a suggested specialization when:

- topic support is at least 5 points;
- support comes from at least two independent Turns or artifacts;
- at least one support item is stronger than host-summary-only evidence;
- no active user rejection exists for the same evidence revision.

The suggestion records supporting evidence and score. Only explicit user acceptance creates `confirmed`; confirmation does not add execution capabilities.

## Selection dimensions

Each eligible thread receives values from 0 to 1:

- `goalRelevance`: coverage of required topics and stated objective terms;
- `evidenceCoverage`: depth and traceability of evidence supporting required subjects;
- `continuity`: exact lineage and explicit reference continuity relative to the query anchor;
- `activityFreshness`: 30-day activity decay;
- `specializationMatch`: confirmed first, then evidence-backed suggested specialization;
- `conflictRisk`: unresolved contradictory required claims;
- `missingRisk`: required subjects supported only by partial, stale, or unreadable coverage.

The Goal Query is first frozen as a validated requirement vector. Each requirement has a canonical subject candidate, kind, importance (`required=3`, `preferred=2`, `contextual=1`), and source span in the user's query. Explicit completion criteria, prohibitions, and the direct object of the requested action are `required`; explicitly optional outcomes are `preferred`; background terms are `contextual`. The parser cannot add a requirement without a user-query source span. If it cannot identify at least one required subject, the query is `incomplete`. Ambiguous subject resolution remains unresolved and contributes to `missingRisk` rather than being silently matched.

Per-requirement match values are:

- `1.00`: same canonical subject with active turn- or artifact-level evidence;
- `0.90`: accepted explicit alias with active evidence;
- `0.75`: same canonical topic with turn-level evidence;
- `0.50`: summary-only or unresolved semantic subject candidate;
- `0.00`: no support.

Per-requirement evidence depth values are:

- `1.00`: exact native, command, artifact, or bounded Turn evidence;
- `0.85`: extracted claim with a directly resolvable source item;
- `0.35`: host-summary-only evidence;
- `0.00`: metadata-only, unresolved, unreadable, or absent evidence.

The query anchor set contains the native origin thread and any threads explicitly named by the user. Project membership is an eligibility condition in the first implementation and does not add ranking points.

Lineage continuity relative to the closest anchor is `1.00` for the anchor itself or a direct parent or child, `0.75` within two exact lineage hops, `0.50` within the same exact lineage component, and `0.00` otherwise. Reference continuity is `1.00` for a direct explicit reference between candidate and anchor, `0.50` when both reference the same active decision or artifact, and `0.00` otherwise.

Dimensions are then computed:

```text
goalRelevance      = weightedMean(requirementMatch, importance)
evidenceCoverage   = weightedMean(requiredEvidenceDepth, required importance)
continuity         = 0.60 * lineageContinuity
                   + 0.40 * referenceContinuity
specializationMatch = weightedMean(perRequirementSpecializationMatch, importance)
conflictRisk       = weightedMean(requiredConflictSeverity, required importance)
missingRisk        = weightedMean(requiredMissingSeverity, required importance)
```

Per-requirement specialization match is `1.00` for a confirmed matching specialization, `0.70` for a suggested matching specialization, `min(0.50, topicWeight / 4)` for raw matching topic evidence, and `0.00` otherwise.

Conflict severity per required subject is `1.00` for an unresolved equal- or higher-authority contradiction, `0.60` for an active lower-authority contradiction, `0.30` for a conflicting proposed alternative, and `0.00` for none.

Missing severity per required subject is `1.00` for absent or unreadable evidence, `0.75` for metadata-only coverage, `0.50` for summary-only or structurally stale coverage, `0.25` for partial but current Turn coverage, and `0.00` for complete current evidence.

When a denominator is zero, the dimension is marked `not_applicable`; it is never fabricated as `0` or `1`. If no query anchor exists, continuity is not applicable and its positive weight is redistributed proportionally across the other applicable positive dimensions.

Native accessibility and writer activity are recorded separately as `navigationState` and `writerState`. They determine the available next action but do not change context-quality ranking.

Provisional ordering score:

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

The positive weights total `1.00`; risks are explicit penalties rather than negative evidence hidden inside another variable. The full vector is stored and displayed. The aggregate only orders eligible candidates.

Selection scores are rounded only at the publication boundary using decimal half-away-from-zero to six places. Threshold comparisons use the unrounded value. A dimension outside `[0, 1]` is invalid; individual dimensions are never silently clamped.

## Selection outcome

- `recommended`: top score at least 0.65, margin over second place at least 0.08, evidence coverage at least 0.60, and no blocking required-subject conflict;
- `ambiguous`: eligible candidates exist but the winner threshold or margin is not met, or candidates have material tradeoffs hidden by the aggregate;
- `no_suitable_candidate`: no eligible candidate or every score is below 0.45;
- `incomplete`: missing or unreadable evidence prevents evaluating required subjects, regardless of apparent score.

Stable ties use native thread ID only for deterministic presentation; a tie-breaker never changes `ambiguous` into `recommended`.

## Recalibration rule

Weights, half-lives, thresholds, and budgets are versioned policy. A change requires fixture results, before-and-after quality metrics, a new policy version, and graph or Selection Report revision. Existing reports remain reproducible under their recorded policy.
