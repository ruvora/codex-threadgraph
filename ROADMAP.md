# Roadmap

## 0.1 — Design baseline

- [x] Product boundary and relationship model
- [x] Read-only discovery skill
- [x] Evidence, inference, authority, and privacy contracts
- [x] Source ingestion, immutable revisions, state, and recovery contracts
- [x] Selection, specialization, host navigation, UI, and ThreadHub boundaries
- [x] ADRs, review checklist, and G0–G8 implementation gates
- [x] Concrete graph-generation pipeline, identity schema, value formulas, and worked example
- [x] G0 seed fixture corpus and executable red contract suite
- [x] G0 contract kernel satisfies all seed fixtures
- [ ] Calibrated extraction, relation, and selection fixture corpus
- [x] Real thread-list and thread-read forward test against Codex 0.152.1

## 0.2 — Local persistent graph

- Versioned SQLite schema
- Incremental indexing and source invalidation
- Deterministic exact-edge extraction
- Bounded semantic inference with confidence calibration
- Project and thread deletion controls

## 0.3 — Interactive graph

- MCP server and graph query API
- Embedded graph application
- Evidence inspector and relation filters
- Native Codex thread navigation
- Large-graph performance and privacy verification

## 0.4 — Optional ThreadHub adapter

- Versioned Context Pack export
- Explicit user-selected handoff
- ThreadHub-side validation and provenance import
- No shared database and no implicit execution authority
