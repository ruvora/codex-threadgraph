import assert from "node:assert/strict";
import test from "node:test";

import { benchmarkIndexing } from "../../scripts/benchmark-indexing.mjs";

test("G12 maximum initial indexing fixture meets frozen resource budgets", async () => {
  const report = await benchmarkIndexing();
  assert.deepEqual(report.failures, []);
  assert.equal(report.passed, true);
  assert.equal(report.measurements.enumeratedThreads, 100);
  assert.equal(report.measurements.deepReadThreads, 12);
  assert.equal(report.measurements.sourceCharacters, 120_000);
  assert.equal(report.measurements.publishedThreadNodes, 100);
  assert.equal(report.measurements.candidatePairs, 1_000);
  assert.equal(report.measurements.omittedCandidatePairs, 3_950);
  assert.equal(report.coverage.state, "partial");
});
