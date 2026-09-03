# ADR-001: Use a heterogeneous evidence graph

Status: Accepted

## Decision

Model projects, threads, topics, decisions, constraints, artifacts, and results as distinct node types. Thread-to-thread relationships are explainable projections over those evidence nodes rather than primary opaque similarity edges.

## Rationale

A thread-only graph can show that two conversations look similar but cannot explain whether they share a topic, disagree on a decision, validate the same artifact, or belong to one lineage. Typed evidence is required for trustworthy selection and conflict discovery.

## Consequences

- Extraction and persistence are more complex than vector similarity alone.
- Every displayed relationship can expose its evidence path.
- Relation-specific rules can distinguish contradiction, continuation, and supersession.
- Embeddings may assist candidate discovery but cannot become the graph source of truth.
