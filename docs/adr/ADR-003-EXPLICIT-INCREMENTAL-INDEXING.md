# ADR-003: Index explicit scope incrementally

Status: Accepted

## Decision

Index only a project, thread set, or bounded query scope requested by the user. Store immutable observations and content digests, reuse unchanged ranges, and atomically publish graph revisions. Do not crawl all threads continuously.

## Rationale

Thread history may be private, large, changing, or temporarily unreadable. Background global crawling creates privacy, token, latency, and invalidation risks that are unnecessary for the first product.

## Consequences

- Initial views may be incomplete until the user expands scope.
- Partial and stale state must be visible.
- Indexing budgets and invalidation are product contracts.
- An external embedding provider is neither required nor used by default.
