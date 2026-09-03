import assert from "node:assert/strict";
import test from "node:test";

import { loadFixtureCorpus } from "./support/fixture-corpus.mjs";

const corpus = await loadFixtureCorpus();

async function requireCapability(capability) {
  let core;
  try {
    core = await import("../../src/core-contract.mjs");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      assert.fail(`[G0] ${capability} is missing from the contract kernel`);
    }
    throw error;
  }
  assert.equal(typeof core[capability], "function", `[G0] ${capability} is missing from the contract kernel`);
  return core[capability];
}

for (const document of corpus) {
  test(`G0 ${document.capability}: ${document.cases.length} contract fixtures`, async () => {
    const capability = await requireCapability(document.capability);
    for (const fixture of document.cases) {
      const input = structuredClone(fixture.input);
      const before = structuredClone(input);
      const actual = await capability(input);
      assert.deepEqual(actual, fixture.expected, `${fixture.id}: ${fixture.description}`);
      assert.deepEqual(input, before, `${fixture.id}: contract functions must not mutate input`);
    }
  });
}
