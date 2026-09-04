import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCalibration, loadCalibrationCorpus } from "../../scripts/calibrate.mjs";

test("held-out corpus is sanitized, evaluation-only, and covers every language slice", () => {
  const corpus = loadCalibrationCorpus();
  assert.equal(corpus.intendedUse, "evaluation_only");
  assert.equal(corpus.sanitized, true);
  for (const group of ["inference", "selection", "authority", "normalization"]) {
    assert.deepEqual([...new Set(corpus[group].map((item) => item.language))].sort(), ["en", "ko", "mixed"]);
    assert.equal(new Set(corpus[group].map((item) => item.id)).size, corpus[group].length);
  }
});

test("G5 and G6 held-out metrics meet every promotion threshold", () => {
  const report = evaluateCalibration(loadCalibrationCorpus());
  assert.deepEqual(report.failures, []);
  assert.equal(report.passed, true);
  assert.equal(report.metrics.deterministicReplayMismatch, 0);
  assert.equal(report.metrics.unsafeRecommendationRateWithBlockingConflict, 0);
});

test("calibration fails closed when a required group is absent", () => {
  const corpus = loadCalibrationCorpus();
  assert.throws(() => evaluateCalibration({ ...corpus, selection: [] }), { code: "CALIBRATION_CORPUS_INVALID" });
});
