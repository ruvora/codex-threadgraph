# ADR-004: Recommendation is not authority

Status: Accepted

## Decision

Thread selection returns an immutable report with eligibility, ranking dimensions, evidence, conflicts, and uncertainty. It never resumes a thread, grants tools, changes specialization, or authorizes work.

## Rationale

Relevance and semantic similarity do not prove correctness, freshness, or permission. Treating a recommendation as authority would repeat the contract failure mode that ThreadHub was designed to prevent.

## Consequences

- `ambiguous`, `no_suitable_candidate`, and `incomplete` are first-class outcomes.
- Navigation is a separate explicit user action and sends no prompt.
- ThreadHub validates any exported context under its own contracts.
- Persistent specialization requires explicit user acceptance.
