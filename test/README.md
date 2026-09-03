# Test strategy

G0 was established as a red baseline before the contract kernel existed. The baseline is preserved in Git history; the current suite must stay green.

- `npm run test:fixtures` validates that the contract corpus is complete, well-formed, and unambiguous. It must pass in G0.
- `npm run test:g0` binds every fixture group to a named core capability and must pass.
- `npm test` runs both layers and any later test suites.

Do not weaken an expected result merely to turn the suite green. A contract change requires the governing design document, fixture, and rationale to change together.
