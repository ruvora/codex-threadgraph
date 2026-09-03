# Inference and authority contract

## Evidence precedence

1. Explicit user decisions
2. Native lineage and timestamps
3. Repository and artifact evidence
4. Explicit statements within a thread
5. Semantic inference

Lower-precedence evidence cannot silently override higher-precedence evidence.

## Relationship classes

- `observed`: directly supported by host or artifact evidence
- `extracted`: stated in source content and linked to an exact source range
- `inferred`: model-derived and confidence-scored

The UI and API must preserve this distinction. Inferred relationships must never be displayed as observed facts.

## Inference gate

An inferred edge is publishable only when:

- every supporting evidence item belongs to the indexed scope;
- its relation kind satisfies the graph semantics;
- confidence is calibrated by the recorded inference version;
- the explanation names the concrete shared or conflicting subjects;
- higher-precedence evidence does not reject it;
- alternatives and uncertainty are retained when materially plausible.

Thresholds are versioned policy, not prompt text. Falling below a display threshold preserves the candidate for diagnostics but excludes it from the current user graph.

## Conflict handling

Contradictory evidence is represented explicitly. ThreadGraph may group competing claims but cannot resolve equal-authority conflict without an explicit user decision or stronger source evidence. Resolution creates a new revision and preserves the rejected alternative.

`supersedes` is never inferred from timestamps alone. Later content may be stale, speculative, or lower authority.

## Selection

Thread recommendations are goal-relative rankings. Each recommendation explains relevant evidence, missing context, conflicts, freshness, and confidence. A recommendation does not grant authority, resume a thread, or start a Turn.

## Specialization

A specialization label requires repeated supporting evidence or an explicit user designation. One incidental task is insufficient. Labels remain suggestions until explicitly accepted when they affect persistent user-facing identity.
