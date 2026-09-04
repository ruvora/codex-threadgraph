#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { fingerprint } from "../src/domain/hashing.mjs";
import { materializeExtraction, resolveSubjects } from "../src/extraction.mjs";
import { evaluateInference } from "../src/inference.mjs";
import { buildGoalQuery, buildSelectionReport } from "../src/selection.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const defaultCorpusPath = join(here, "../test/calibration/held-out-v1.json");
const projectId = `prj_${"a".repeat(52)}`;
const threadId = `thr_${"b".repeat(52)}`;
const graphRevisionId = `grv_${"c".repeat(52)}`;
const confidencePolicyVersion = "confidence-policy/1-alpha";

const profiles = Object.freeze({
  high: { goalRelevance: 0.95, evidenceCoverage: 0.9, continuity: 0.8, activityFreshness: 0.9, specializationMatch: 0.8, conflictRisk: 0, missingRisk: 0 },
  close: { goalRelevance: 0.9, evidenceCoverage: 0.9, continuity: 0.8, activityFreshness: 0.9, specializationMatch: 0.8, conflictRisk: 0, missingRisk: 0 },
  low: { goalRelevance: 0.3, evidenceCoverage: 0.4, continuity: 0.2, activityFreshness: 0.4, specializationMatch: 0, conflictRisk: 0.1, missingRisk: 0.2 },
});

function ratio(numerator, denominator) {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 1_000_000) / 1_000_000;
}

function inferenceInput(fixture) {
  return {
    candidate: {
      leftId: "left",
      rightId: "right",
      strength: {
        strength: fixture.strength ?? "strong",
        categories: fixture.categories ?? 2,
        points: fixture.strength === "weak" ? 1 : fixture.strength === "moderate" ? 3 : 6,
        policyVersion: "relation-strength/1-alpha",
      },
    },
    semantic: {
      kind: fixture.kind,
      sourceId: "left",
      targetId: "right",
      evidenceIds: ["evd_1", "evd_2"],
      hasEvidenceClosure: fixture.hasEvidenceClosure ?? true,
      hasUnresolvedCounterEvidence: fixture.hasUnresolvedCounterEvidence ?? false,
      independenceKeys: Array.from({ length: fixture.ranges ?? 1 }, (_, index) => `range-${index}`),
      concreteSubject: fixture.concreteSubject,
      explanation: `Held-out fixture ${fixture.id}`,
      alternatives: [],
      inferenceVersion: "inference/1-alpha",
      sameCanonicalSubject: fixture.sameCanonicalSubject,
      incompatiblePredicateOrPolarity: fixture.incompatiblePredicateOrPolarity,
      overlappingValidity: fixture.overlappingValidity,
      leftEvidenceClass: fixture.leftEvidenceClass,
      rightEvidenceClass: fixture.rightEvidenceClass,
      isLater: fixture.isLater,
      explicitReplacementEvidence: fixture.explicitReplacementEvidence,
      acceptedUserResolution: fixture.acceptedUserResolution,
      subjectContinuity: fixture.subjectContinuity,
      exactLineage: fixture.exactLineage,
      explicitReference: fixture.explicitReference,
    },
  };
}

function evaluateInferenceFixtures(fixtures) {
  return fixtures.map((fixture) => {
    const input = inferenceInput(fixture);
    const actual = evaluateInference(input.candidate, input.semantic);
    return { id: fixture.id, language: fixture.language, kind: fixture.kind, expectedAllow: fixture.expectedAllow, expectedBand: fixture.expectedBand ?? null, actualDecision: actual.decision, actualBand: actual.confidenceBand ?? null, actualCode: actual.code ?? null };
  });
}

function evaluateSelectionFixtures(fixtures) {
  return fixtures.map((fixture) => {
    const query = buildGoalQuery({ graphRevisionId, scopeId: projectId, objective: fixture.id, requirements: [{ subject: fixture.id, importance: "required", sourceSpan: fixture.id }], observationCutoff: "2026-09-04T00:00:00.000Z" });
    const candidates = fixture.candidates.map((candidate) => ({
      threadId: candidate.threadId,
      nativeThreadId: `native-${candidate.threadId}`,
      projectId: candidate.outsideScope ? `prj_${"d".repeat(52)}` : projectId,
      dimensions: profiles[candidate.profile],
      evidenceIds: ["evd_1"],
      conflicts: [],
      missingEvidence: [],
      freshness: "current",
      requiredEvidenceUnavailable: candidate.requiredEvidenceUnavailable === true,
      blockingConflict: candidate.blockingConflict === true,
    }));
    const report = buildSelectionReport(query, candidates);
    return { id: fixture.id, language: fixture.language, expectedResult: fixture.expectedResult, expectedThreadId: fixture.expectedThreadId ?? null, actualResult: report.result, actualThreadId: report.result === "recommended" ? report.candidates[0]?.threadId ?? null : null, unsafeRecommendation: report.result === "recommended" && report.candidates[0]?.blockingConflict === true };
  });
}

function sourceFor(fixture) {
  const text = fixture.language === "ko" ? "이 결정을 적용한다." : fixture.language === "mixed" ? "Apply 이 decision." : "Apply this decision.";
  return { schemaVersion: "source-envelope/1-alpha", projectId, threadId, nativeThreadId: fixture.id, range: { startTurnId: "t1", endTurnId: "t1", itemIndexes: [0] }, observedAt: "2026-09-04T00:00:00.000Z", sourceUpdatedAt: "2026-09-03T00:00:00.000Z", contentDigest: fingerprint("calibration-source-content/1", text), redactionPolicy: "redaction/1-alpha", coverage: "turn_indexed", items: [{ locator: "t1:item-0", role: "user", type: "message", text }] };
}

function evaluateAuthorityFixtures(fixtures) {
  return fixtures.map((fixture) => {
    const source = sourceFor(fixture);
    const extraction = { schemaVersion: "extraction/1-alpha", sourceEnvelopeDigest: fingerprint("source-envelope/1", source), extractorVersion: "extractor/1-alpha", claims: [{ kind: fixture.kind, subjectCandidate: fixture.id, modality: fixture.modality, polarity: "affirm", lifecycle: fixture.lifecycle, evidenceLocators: ["t1:item-0"] }], aliases: [], relationCandidates: [], warnings: [] };
    let active = false;
    let code = null;
    try {
      active = materializeExtraction(source, extraction).claims.some((claim) => claim.lifecycle === "active" && ["decision", "constraint"].includes(claim.kind));
    } catch (error) {
      code = error.code ?? "UNKNOWN";
    }
    return { id: fixture.id, language: fixture.language, expectedActive: fixture.expectedActive, actualActive: active, code };
  });
}

function evaluateNormalizationFixtures(fixtures) {
  return fixtures.map((fixture) => {
    const aliases = fixture.alias ? [{ entityKind: fixture.kind, alias: fixture.alias, entityId: fixture.aliasEntityId }] : [];
    const [result] = resolveSubjects([{ kind: fixture.kind, subjectCandidate: fixture.subjectCandidate }], aliases);
    return { id: fixture.id, language: fixture.language, expectedNormalized: fixture.expectedNormalized, expectedCanonicalSubjectId: fixture.expectedCanonicalSubjectId, actualNormalized: result.normalizedSubject, actualCanonicalSubjectId: result.canonicalSubjectId };
  });
}

function resultSnapshot(corpus) {
  return {
    inference: evaluateInferenceFixtures(corpus.inference),
    selection: evaluateSelectionFixtures(corpus.selection),
    authority: evaluateAuthorityFixtures(corpus.authority),
    normalization: evaluateNormalizationFixtures(corpus.normalization),
  };
}

function accuracy(items, predicate) {
  return ratio(items.filter(predicate).length, items.length);
}

export function evaluateCalibration(corpus) {
  if (corpus?.schemaVersion !== "calibration-corpus/1" || corpus.intendedUse !== "evaluation_only" || corpus.sanitized !== true) throw Object.assign(new Error("Calibration corpus metadata is invalid"), { code: "CALIBRATION_CORPUS_INVALID" });
  for (const group of ["inference", "selection", "authority", "normalization"]) if (!Array.isArray(corpus[group]) || corpus[group].length === 0) throw Object.assign(new Error(`Calibration group ${group} is empty`), { code: "CALIBRATION_CORPUS_INVALID" });
  const first = resultSnapshot(corpus);
  const second = resultSnapshot(corpus);
  const replayMismatch = JSON.stringify(first) === JSON.stringify(second) ? 0 : 1;
  const published = first.inference.filter((item) => item.actualDecision === "allow");
  const high = published.filter((item) => item.actualBand === "high");
  const medium = published.filter((item) => item.actualBand === "medium");
  const contradictions = published.filter((item) => item.kind === "contradicts");
  const supersessions = published.filter((item) => item.kind === "supersedes");
  const predictedActive = first.authority.filter((item) => item.actualActive);
  const expectedRelations = first.inference.filter((item) => item.expectedAllow);
  const correctSelection = first.selection.filter((item) => item.actualResult === item.expectedResult && (item.actualResult !== "recommended" || item.actualThreadId === item.expectedThreadId));
  const incompleteExpected = first.selection.filter((item) => item.expectedResult === "incomplete");
  const correctNormalization = first.normalization.filter((item) => item.actualNormalized === item.expectedNormalized && item.actualCanonicalSubjectId === item.expectedCanonicalSubjectId);
  const metrics = {
    highBandInferredEdgePrecision: ratio(high.filter((item) => item.expectedAllow).length, high.length),
    mediumBandInferredEdgePrecision: ratio(medium.filter((item) => item.expectedAllow).length, medium.length),
    contradictionPrecision: ratio(contradictions.filter((item) => item.expectedAllow).length, contradictions.length),
    supersessionPrecision: ratio(supersessions.filter((item) => item.expectedAllow).length, supersessions.length),
    activeDecisionConstraintPrecision: ratio(predictedActive.filter((item) => item.expectedActive).length, predictedActive.length),
    recommendedOutcomeCorrectness: ratio(correctSelection.length, first.selection.length),
    unsafeRecommendationRateWithBlockingConflict: ratio(first.selection.filter((item) => item.unsafeRecommendation).length, first.selection.length),
    correctAbstentionForIncompleteEvidence: ratio(incompleteExpected.filter((item) => item.actualResult === "incomplete").length, incompleteExpected.length),
    deterministicReplayMismatch: replayMismatch,
    canonicalNormalizationAccuracy: ratio(correctNormalization.length, first.normalization.length),
    inferredEdgeRecall: ratio(published.filter((item) => item.expectedAllow).length, expectedRelations.length),
  };
  const languageSlices = Object.fromEntries(["en", "ko", "mixed"].map((language) => {
    const items = [...first.inference.map((item) => ({ language: item.language, correct: (item.actualDecision === "allow") === item.expectedAllow })), ...first.selection.map((item) => ({ language: item.language, correct: item.actualResult === item.expectedResult && (item.actualResult !== "recommended" || item.actualThreadId === item.expectedThreadId) })), ...first.authority.map((item) => ({ language: item.language, correct: item.actualActive === item.expectedActive })), ...first.normalization.map((item) => ({ language: item.language, correct: item.actualNormalized === item.expectedNormalized && item.actualCanonicalSubjectId === item.expectedCanonicalSubjectId }))].filter((item) => item.language === language);
    return [language, { cases: items.length, accuracy: accuracy(items, (item) => item.correct) }];
  }));
  const thresholds = { highBandInferredEdgePrecision: 0.95, mediumBandInferredEdgePrecision: 0.85, contradictionPrecision: 0.98, supersessionPrecision: 1, activeDecisionConstraintPrecision: 0.95, recommendedOutcomeCorrectness: 0.9, unsafeRecommendationRateWithBlockingConflict: 0, correctAbstentionForIncompleteEvidence: 0.95, deterministicReplayMismatch: 0, canonicalNormalizationAccuracy: 1 };
  const failures = Object.entries(thresholds).filter(([name, threshold]) => name.includes("Rate") || name.includes("Mismatch") ? metrics[name] > threshold : metrics[name] === null || metrics[name] < threshold).map(([name]) => name);
  if (Object.values(languageSlices).some((slice) => slice.cases === 0 || slice.accuracy < 0.9)) failures.push("languageSliceAccuracy");
  return { schemaVersion: "calibration-report/1", corpusId: corpus.corpusId, policyVersions: { inference: "inference/1-alpha", confidence: confidencePolicyVersion, selection: "selection-policy/1-alpha", extraction: "extractor/1-alpha", normalization: "normalization/1-alpha" }, counts: { inference: first.inference.length, selection: first.selection.length, authority: first.authority.length, normalization: first.normalization.length }, metrics, thresholds, languageSlices, failures: [...new Set(failures)].sort(), passed: failures.length === 0, cases: first };
}

export function loadCalibrationCorpus(path = defaultCorpusPath) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = evaluateCalibration(loadCalibrationCorpus(process.argv[2]));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}
