# ADR-003: Index explicit scope incrementally

Status: Accepted

## Decision

In the first implementation, index a canonical project only on its first graph open or an explicit user refresh. Store immutable observations and content digests, reuse unchanged ranges, and atomically publish graph revisions. Queries never update the index, and the product does not crawl threads continuously.

## Rationale

Thread history may be private, large, changing, or temporarily unreadable. Background global crawling creates privacy, token, latency, and invalidation risks that are unnecessary for the first product.

## Consequences

- The first graph open may wait for initial indexing; subsequent opens are immediate reads of the published revision.
- Stale query results remain visible until the user explicitly refreshes.
- Partial and stale state must be visible.
- Indexing budgets and invalidation are product contracts.
- An external embedding provider is neither required nor used by default.
