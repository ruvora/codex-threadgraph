import assert from "node:assert/strict";
import test from "node:test";
import { evaluateInference, generateRelationCandidates } from "../../src/inference.mjs";

const projectId = "p";
const a = { id: "a", projectId, topicIds: ["topic-db"], activeDecisionIds: ["decision-db"], artifactIds: [], activeConstraintIds: [], referenceIds: [] };
const b = { id: "b", projectId, topicIds: ["topic-db"], activeDecisionIds: ["decision-db"], artifactIds: [], activeConstraintIds: [], referenceIds: [] };

test("G5 blocks candidates deterministically within the policy budget", () => {
  const result = generateRelationCandidates([b, a]);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual([result.candidates[0].leftId, result.candidates[0].rightId], ["a", "b"]);
  assert.equal(result.candidates[0].strength.strength, "moderate");
  assert.throws(() => generateRelationCandidates([a, b], 1001), { code: "INFERENCE_BUDGET_INVALID" });
});

test("G5 publishes a calibrated relation without accepting numeric model confidence", () => {
  const candidate = generateRelationCandidates([a, b]).candidates[0];
  const result = evaluateInference(candidate, { kind: "related_to", sourceId: "a", targetId: "b", evidenceIds: ["evd_1", "evd_2"], hasEvidenceClosure: true, independenceKeys: ["turn-1", "turn-2"], concreteSubject: "database", explanation: "Both contain the active database decision.", alternatives: [], inferenceVersion: "inference/1-alpha", confidence: 0.999 });
  assert.equal(result.confidenceBand, "high");
  assert.equal("confidence" in result, false);
});

test("G5 topic overlap cannot create contradiction", () => {
  const candidate = generateRelationCandidates([a, b]).candidates[0];
  const result = evaluateInference(candidate, { kind: "contradicts", evidenceIds: ["e"], hasEvidenceClosure: true, sameCanonicalSubject: false, incompatiblePredicateOrPolarity: false, overlappingValidity: true, leftEvidenceClass: "inferred", rightEvidenceClass: "inferred", independenceKeys: ["t"], concreteSubject: "db" });
  assert.equal(result.code, "CONTRADICTION_SEMANTICS_MISSING");
});

test("G5 recency alone cannot create supersession", () => {
  const candidate = generateRelationCandidates([a, b]).candidates[0];
  const result = evaluateInference(candidate, { kind: "supersedes", evidenceIds: ["e"], hasEvidenceClosure: true, isLater: true, explicitReplacementEvidence: false, acceptedUserResolution: false });
  assert.equal(result.code, "SUPERSESSION_AUTHORITY_MISSING");
});

test("G5 unresolved counter-evidence rejects publication", () => {
  const candidate = generateRelationCandidates([a, b]).candidates[0];
  const result = evaluateInference(candidate, { kind: "related_to", evidenceIds: ["e"], hasEvidenceClosure: true, independenceKeys: ["t"], concreteSubject: "db", hasUnresolvedCounterEvidence: true });
  assert.equal(result.code, "CONFIDENCE_REJECTED");
});
