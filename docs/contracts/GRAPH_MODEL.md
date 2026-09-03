# Graph model contract

## Node types

- `project`: canonical workspace or project identity
- `thread`: native Codex thread identity
- `topic`: normalized subject discussed by one or more threads
- `decision`: an explicit choice with provenance
- `constraint`: a requirement or prohibition with provenance
- `artifact`: a file, patch, commit, report, or other produced output
- `result`: a structured observed outcome

## Edge classes

Exact edges come from host or repository evidence:

- `belongs_to`
- `forked_from`
- `produced`
- `validated`
- `references`

Inferred edges require confidence and explanation:

- `related_to`
- `continues`
- `contradicts`
- `supersedes`
- `specializes_in`

## Required fields

Every node and edge records a stable ID, kind, observed time, source reference, source digest, and extraction revision. Inferred edges additionally record confidence, explanation, supporting evidence IDs, and inference version.

## Projection rule

A direct thread-to-thread edge is a projection over underlying evidence. The graph must retain the evidence path that produced it. A similarity score without an inspectable evidence path is not a valid relationship.
