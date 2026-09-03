import assert from "node:assert/strict";
import test from "node:test";

import { loadFixtureCorpus } from "./support/fixture-corpus.mjs";

const requiredCapabilities = new Set([
  "authorizeIndexUpdate",
  "authorizeRecommendationAction",
  "deriveConfidenceBand",
  "deriveFreshness",
  "deriveRelationStrength",
  "deriveSelectionScore",
  "deriveSourceDigest",
  "deriveStableId",
  "validateEvidence",
  "validateModelEnvelope",
  "validateRelation",
  "validateScope",
]);

test("G0 fixture corpus is complete and structurally valid", async () => {
  const corpus = await loadFixtureCorpus();
  const capabilities = new Set();
  const caseIds = new Set();

  for (const document of corpus) {
    assert.equal(document.schemaVersion, "g0-fixture/1", `${document.name}: schemaVersion`);
    assert.equal(typeof document.capability, "string", `${document.name}: capability`);
    assert.equal(capabilities.has(document.capability), false, `duplicate capability: ${document.capability}`);
    capabilities.add(document.capability);
    assert.ok(Array.isArray(document.cases) && document.cases.length >= 2, `${document.name}: at least two cases`);

    for (const fixture of document.cases) {
      assert.match(fixture.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${document.name}: invalid case id`);
      assert.equal(caseIds.has(fixture.id), false, `duplicate case id: ${fixture.id}`);
      caseIds.add(fixture.id);
      assert.ok(typeof fixture.description === "string" && fixture.description.length > 0, `${fixture.id}: description`);
      assert.ok(fixture.input && typeof fixture.input === "object" && !Array.isArray(fixture.input), `${fixture.id}: input`);
      assert.ok(fixture.expected && typeof fixture.expected === "object" && !Array.isArray(fixture.expected), `${fixture.id}: expected`);
    }
  }

  assert.deepEqual(capabilities, requiredCapabilities);
  assert.ok(caseIds.size >= 40, `expected at least 40 boundary fixtures, received ${caseIds.size}`);
});
