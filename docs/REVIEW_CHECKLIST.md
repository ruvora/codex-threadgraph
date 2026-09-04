# Design review checklist

## Product boundary

- [x] Read-only knowledge and navigation are separate from execution orchestration.
- [x] Native history, user decisions, graph derivations, and execution authority have distinct owners.
- [x] ThreadHub is optional and has no shared database.

## Graph semantics

- [x] Node and relation types are explicit.
- [x] Direct thread relationships retain evidence paths.
- [x] Contradiction and supersession require more than similarity or recency.
- [x] Canonical subject normalization rules have representative English, Korean, mixed-language, NFKC, spacing, casing, and accepted-alias fixtures.
- [x] Artifact identity separates logical project paths from content revisions across worktrees.
- [x] Stable ID and relation revision rules are defined.
- [x] Candidate blocking prevents unbounded all-pairs inference.

## Ingestion and privacy

- [x] Scope is explicit and cannot self-expand.
- [x] First development updates only on initial project-graph open and explicit refresh.
- [x] Queries and navigation never update the graph.
- [x] Thread content is untrusted data.
- [x] Indexing is bounded, incremental, and local by default.
- [x] Unreadable, missing, and deleted are distinct.
- [x] Default numeric indexing budgets have a saturated 100-thread/12-read/120,000-character/1,000-pair fixture and recorded measurements.
- [x] Version 0.1 explicitly relies on OS account and volume protection, enforces owner-only Registry files on POSIX, and does not claim application-level encryption.

## Selection and specialization

- [x] Eligibility and ranking are separate.
- [x] Results include recommended, ambiguous, no candidate, and incomplete.
- [x] Recommendation and specialization do not grant authority.
- [x] Persistent specialization requires explicit user acceptance.
- [x] Ranking and abstention policies have a sanitized held-out fixture corpus, reproducible metrics, language slices, and frozen promotion thresholds.
- [x] Provisional value formulas and promotion metrics are explicit.

## Persistence and recovery

- [x] Graph revisions are immutable and atomically published.
- [x] Writer fencing, migrations, backups, and restart recovery are required.
- [x] Deletion affects only the local graph and never native history.
- [x] The versioned SQLite tables, indexes, session state, and migration path are implemented and tested.

## Experience and integration

- [x] Evidence inspection and failure states are first-class.
- [x] Navigation sends no prompt.
- [x] Context Pack excludes execution permissions.
- [x] The MCP Apps SVG/list prototype has bounded rendering and measured 5,000-node/10,000-relation latency, memory, payload, and privacy budgets.
- [x] Stable `thread/list` and `thread/read` behavior is verified against Codex 0.152.1 without loading or starting a thread.

No unchecked item blocks the design baseline. Each unchecked item is deliberately assigned to an implementation gate and must be resolved before that gate exits.
