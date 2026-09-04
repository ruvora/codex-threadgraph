import assert from "node:assert/strict";
import test from "node:test";
import { deriveExactRelations, materializeExtraction, planIncrementalUpdate, resolveSubjects } from "../../src/extraction.mjs";
import { fingerprint } from "../../src/domain/hashing.mjs";

const projectId = `prj_${"a".repeat(52)}`;
const threadId = `thr_${"b".repeat(52)}`;
function source() {
  return { schemaVersion: "source-envelope/1-alpha", projectId, threadId, nativeThreadId: "n1", range: { startTurnId: "t1", endTurnId: "t1", itemIndexes: [0] }, observedAt: "2026-09-04T00:00:00.000Z", sourceUpdatedAt: "2026-09-03T00:00:00.000Z", contentDigest: `sha256:${"c".repeat(64)}`, redactionPolicy: "redaction/1-alpha", coverage: "turn_indexed", items: [{ locator: "t1:item-0", role: "user", type: "message", text: "Use SQLite." }] };
}
function extraction(overrides = {}) {
  return { schemaVersion: "extraction/1-alpha", sourceEnvelopeDigest: fingerprint("source-envelope/1", source()), extractorVersion: "extractor/1-alpha", claims: [{ kind: "decision", subjectCandidate: "Storage", modality: "asserted", polarity: "affirm", lifecycle: "active", predicate: "uses", object: "SQLite", evidenceLocators: ["t1:item-0"] }], aliases: [], relationCandidates: [], warnings: [], ...overrides };
}

test("G4 materializes provenance-closed claims deterministically", () => {
  const first = materializeExtraction(source(), extraction());
  const second = materializeExtraction(source(), extraction());
  assert.deepEqual(first, second);
  assert.match(first.claims[0].id, /^clm_/);
  assert.equal(first.claims[0].evidenceIds[0], first.evidenceItems[0].id);
  assert.equal(first.observation.id.startsWith("obs_"), true);
});

test("G4 preserves modality and rejects active proposals", () => {
  const proposed = extraction();
  proposed.claims[0].modality = "proposed";
  assert.throws(() => materializeExtraction(source(), proposed), { code: "CLAIM_AUTHORITY_INVALID" });
});

test("G4 rejects ambiguous accepted aliases", () => {
  assert.throws(() => resolveSubjects([{ kind: "topic", subjectCandidate: "DB" }], [
    { entityKind: "topic", alias: "db", entityId: "ent_1" },
    { entityKind: "topic", alias: "DB", entityId: "ent_2" },
  ]), { code: "SUBJECT_MERGE_AMBIGUOUS" });
});

test("G4 derives exact lineage and detects cycles", () => {
  const evidenceIds = [`evd_${"e".repeat(52)}`];
  const root = { id: threadId, evidenceIds };
  const child = { id: `thr_${"c".repeat(52)}`, parentId: threadId, evidenceIds };
  const relations = deriveExactRelations({ scopeId: projectId, projectId, threads: [root, child] });
  assert.equal(relations.filter((item) => item.kind === "forked_from").length, 1);
  assert.throws(() => deriveExactRelations({ scopeId: projectId, projectId, threads: [{ ...root, parentId: child.id }, child] }), { code: "LINEAGE_CYCLE" });
});

test("G4 reuses unchanged sources and invalidates only changed dependents", () => {
  const result = planIncrementalUpdate({ sources: [
    { threadId: "a", contentDigest: "same", sourceUpdatedAt: "1", evidenceIds: ["ea"] },
    { threadId: "b", contentDigest: "old", sourceUpdatedAt: "1", evidenceIds: ["eb"] },
  ] }, [
    { threadId: "a", contentDigest: "same", sourceUpdatedAt: "1" },
    { threadId: "b", contentDigest: "new", sourceUpdatedAt: "2" },
  ]);
  assert.deepEqual(result, { reused: ["a"], changed: ["b"], invalidEvidenceIds: ["eb"] });
});
