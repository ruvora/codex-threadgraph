# Graph contract

Use these node kinds: `project`, `thread`, `topic`, `decision`, `constraint`, `artifact`, and `result`.

Use observed edges for `belongs_to`, `forked_from`, `produced`, `validated`, and `references`. Use inferred edges for `related_to`, `continues`, `contradicts`, `supersedes`, and `specializes_in` unless exact source evidence proves the relation.

For each edge provide:

- source and target IDs;
- relation kind;
- evidence class: `observed`, `extracted`, or `inferred`;
- concise evidence reference;
- observation time when available;
- confidence for inferred edges;
- one-sentence explanation.

Recommendations must distinguish relevance from authority and call out unresolved conflicts.
