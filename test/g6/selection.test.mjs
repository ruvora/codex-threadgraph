import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalQuery, buildSelectionReport, reviseSpecialization, suggestSpecialization } from "../../src/selection.mjs";

const scopeId = `prj_${"a".repeat(52)}`;
const graphRevisionId = `grv_${"b".repeat(52)}`;
function query() { return buildGoalQuery({ graphRevisionId, scopeId, objective: "Implement storage", requirements: [{ subject: "storage", importance: "required", sourceSpan: "storage" }], observationCutoff: "2026-09-04T00:00:00.000Z" }); }
function candidate(threadId, scoreDimensions) { return { threadId, nativeThreadId: `native-${threadId}`, projectId: scopeId, dimensions: scoreDimensions, evidenceIds: ["evd_1"], conflicts: [], missingEvidence: [], freshness: "current" }; }
const high = { goalRelevance: 0.95, evidenceCoverage: 0.9, continuity: 0.8, activityFreshness: 0.9, specializationMatch: 0.8, conflictRisk: 0, missingRisk: 0 };
const low = { goalRelevance: 0.3, evidenceCoverage: 0.4, continuity: 0.2, activityFreshness: 0.4, specializationMatch: 0, conflictRisk: 0.1, missingRisk: 0.2 };

test("G6 requires a source-backed required subject", () => {
  const result = buildGoalQuery({ graphRevisionId, scopeId, objective: "help", requirements: [] });
  assert.equal(result.result, "incomplete");
});

test("G6 produces a dimensioned recommended report", () => {
  const report = buildSelectionReport(query(), [candidate("a", high), candidate("b", low)]);
  assert.equal(report.result, "recommended");
  assert.equal(report.candidates[0].threadId, "a");
  assert.deepEqual(Object.keys(report.candidates[0].dimensions).sort(), Object.keys(high).sort());
  assert.match(report.id, /^sel_/);
});

test("G6 preserves ambiguous, no suitable, and incomplete outcomes", () => {
  const close = { ...high, goalRelevance: 0.9 };
  assert.equal(buildSelectionReport(query(), [candidate("a", high), candidate("b", close)]).result, "ambiguous");
  assert.equal(buildSelectionReport(query(), [candidate("a", low)]).result, "no_suitable_candidate");
  assert.equal(buildSelectionReport(query(), [{ ...candidate("a", high), requiredEvidenceUnavailable: true }]).result, "incomplete");
});

test("G6 blocks ineligible and conflicted recommendations", () => {
  const outside = { ...candidate("outside", high), projectId: "other" };
  assert.equal(buildSelectionReport(query(), [outside]).result, "no_suitable_candidate");
  const blocked = { ...candidate("a", high), blockingConflict: true };
  assert.equal(buildSelectionReport(query(), [blocked]).result, "ambiguous");
});

test("G6 specialization requires repeated evidence and explicit confirmation", () => {
  assert.equal(suggestSpecialization({ threadId: "t", topicId: "db", supportPoints: 5, independenceKeys: ["one"], evidenceIds: ["e"], hasDirectEvidence: true }), null);
  const suggested = suggestSpecialization({ threadId: "t", topicId: "db", supportPoints: 5, independenceKeys: ["one", "two"], evidenceIds: ["e1", "e2"], hasDirectEvidence: true });
  assert.equal(suggested.lifecycle, "suggested");
  assert.throws(() => reviseSpecialization(suggested, "confirmed", { explicitUserAction: false }), { code: "SPECIALIZATION_ACCEPTANCE_REQUIRED" });
  assert.equal(reviseSpecialization(suggested, "confirmed", { explicitUserAction: true, origin: "user" }).lifecycle, "confirmed");
});
