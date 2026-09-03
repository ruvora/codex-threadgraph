# Test strategy

G0 deliberately starts red.

- `npm run test:fixtures` validates that the contract corpus is complete, well-formed, and unambiguous. It must pass in G0.
- `npm run test:g0:red` binds every fixture group to a named core capability. It must fail once per unimplemented capability in G0.
- `npm test` runs both layers. It remains red until the G1 and G2 core contracts satisfy every fixture.

Do not weaken an expected result merely to turn the suite green. A contract change requires the governing design document, fixture, and rationale to change together.
