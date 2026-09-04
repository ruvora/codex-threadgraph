# Test strategy

G0 was established as a red baseline before the contract kernel existed. The baseline is preserved in Git history; the current suite must stay green.

- `npm run test:fixtures` validates that the contract corpus is complete, well-formed, and unambiguous. It must pass in G0.
- `npm run test:g0` binds every fixture group to a named core capability and must pass.
- `npm run test:g1` verifies strict envelopes, typed identities, immutable Graph Revisions, evidence closure, and relation lifecycle.
- `npm run test:g2` through `npm run test:g8` verify each implementation gate independently.
- `npm run test:g9` verifies the durable prepare/extract/publish session and complete pipeline composition.
- `npm run test:g10` verifies temporary-source scrubbing and explicitly confirmed indexed-thread deletion.
- `npm run test:calibration` evaluates the versioned, sanitized held-out corpus against every G5/G6 promotion threshold.
- `npm run calibrate` emits the full reproducible calibration report, including language slices and recall.
- `npm test` runs the complete contract and implementation suite.

Do not weaken an expected result merely to turn the suite green. A contract change requires the governing design document, fixture, and rationale to change together.
