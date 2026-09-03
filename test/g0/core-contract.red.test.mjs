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
      assert.fail(`[G0 RED] ${capability} is not implemented; its fixtures are ready`);
    }
    throw error;
  }
  assert.equal(typeof core[capability], "function", `[G0 RED] ${capability} is not implemented; its fixtures are ready`);
  return core[capability];
}

for (const document of corpus) {
  test(`G0 RED ${document.capability}: ${document.cases.length} contract fixtures`, async () => {
    const capability = await requireCapability(document.capability);
    for (const fixture of document.cases) {
      const actual = await capability(structuredClone(fixture.input));
      assert.deepEqual(actual, fixture.expected, `${fixture.id}: ${fixture.description}`);
    }
  });
}
