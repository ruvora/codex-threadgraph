import assert from "node:assert/strict";
import test from "node:test";

const projectId = "prj_gvirg6d5hdvr7l4t7y3ai2d3xvhnee7gmyjzgt4xkiygmy2ejdyq";
const threadId = "thr_ptb37vxwbn6pfjteocmhhn5fdmzfg7ilunakyokctdozld5mzrha";
const observationId = "obs_vmi3kphawdwxt7f6t4zoes7vjg57mibwjef55u2ega6t7ngrrf7q";
const evidenceId = "evd_jbarqyady4a6sov6uohml2v3jyygtizycdu5wbfthx5eollzhlfq";
const topicId = "ent_018f0c4a-7b2c-7d31-8f2a-123456789abc";
const digest = `sha256:${"c".repeat(64)}`;

async function domain() {
  try {
    return await import("../../src/domain-model.mjs");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") assert.fail("[G1 RED] domain model is not implemented");
    throw error;
  }
}

function sourceEnvelope(overrides = {}) {
  return {
    schemaVersion: "source-envelope/1-alpha",
    projectId,
    threadId,
    nativeThreadId: "native-123",
    range: { startTurnId: "turn-1", endTurnId: "turn-1", itemIndexes: [0] },
    observedAt: "2026-09-03T00:00:00.000Z",
    sourceUpdatedAt: "2026-09-02T22:00:00.000Z",
    contentDigest: digest,
    redactionPolicy: "redaction/1-alpha",
    coverage: "turn_indexed",
    items: [{ locator: "turn-1:item-0", role: "user", type: "message", text: "Use immutable graph revisions." }],
    ...overrides,
  };
}

function extractionEnvelope(overrides = {}) {
  return {
    schemaVersion: "extraction/1-alpha",
    sourceEnvelopeDigest: digest,
    extractorVersion: "extractor/1-alpha",
    claims: [{
      kind: "topic",
      subjectCandidate: "immutable graph revisions",
      modality: "asserted",
      polarity: "affirm",
      lifecycle: "active",
      evidenceLocators: ["turn-1:item-0"],
    }],
    aliases: [],
    relationCandidates: [],
    warnings: [],
    ...overrides,
  };
}

function graphInput(overrides = {}) {
  return {
    scopeId: projectId,
    parentRevisionId: null,
    observationCutoff: "2026-09-03T00:00:00.000Z",
    policies: {
      schema: "graph-schema/1-alpha",
      identity: "id-policy/1-alpha",
      index: "index-policy/1-alpha",
      extraction: "extractor/1-alpha",
      normalization: "normalization/1-alpha",
      relation: "relation-policy/1-alpha",
      redaction: "redaction/1-alpha",
    },
    observations: [{
      id: observationId,
      projectId,
      threadId,
      sourceRange: { startTurnId: "turn-1", endTurnId: "turn-1" },
      contentDigest: digest,
      redactionVersion: "redaction/1-alpha",
      authorized: true,
      observedAt: "2026-09-03T00:00:00.000Z",
    }],
    evidenceItems: [{
      id: evidenceId,
      observationId,
      itemLocator: "turn-1:item-0",
      contentDigest: digest,
    }],
    nodes: [
      { id: projectId, kind: "project", scopeId: projectId, canonicalSubjectKey: projectId, lifecycle: "current", evidenceIds: [evidenceId] },
      { id: threadId, kind: "thread", scopeId: projectId, canonicalSubjectKey: threadId, lifecycle: "current", evidenceIds: [evidenceId] },
      { id: topicId, kind: "topic", scopeId: projectId, canonicalSubjectKey: "topic:immutable-graph-revisions", lifecycle: "current", evidenceIds: [evidenceId] },
    ],
    relations: [{
      sourceId: threadId,
      targetId: topicId,
      kind: "related_to",
      evidenceClass: "inferred",
      evidenceIds: [evidenceId],
      confidenceBand: "high",
      explanation: "The source explicitly discusses immutable graph revisions.",
      inferenceVersion: "inference/1-alpha",
      alternatives: [],
      policyVersion: "relation-policy/1-alpha",
      lifecycle: "current",
    }, {
      sourceId: threadId,
      targetId: projectId,
      kind: "belongs_to",
      evidenceClass: "observed",
      evidenceIds: [evidenceId],
      confidenceBand: null,
      policyVersion: "relation-policy/1-alpha",
      lifecycle: "current",
    }],
    ...overrides,
  };
}

test("G1 typed IDs distinguish entity kinds", async () => {
  const { assertTypedId, isTypedId } = await domain();
  assert.equal(isTypedId(projectId, "project"), true);
  assert.equal(isTypedId(threadId, "thread"), true);
  assert.equal(isTypedId(threadId, "project"), false);
  assert.throws(() => assertTypedId("thr_bad", "thread"), { code: "ID_INVALID" });
});

test("G1 fingerprints are key-order independent but array-order sensitive", async () => {
  const { fingerprint } = await domain();
  assert.equal(fingerprint("test/1", { a: 1, b: 2 }), fingerprint("test/1", { b: 2, a: 1 }));
  assert.notEqual(fingerprint("test/1", ["a", "b"]), fingerprint("test/1", ["b", "a"]));
  assert.match(fingerprint("test/1", { a: 1 }), /^sha256:[0-9a-f]{64}$/);
});

test("G1 source envelopes are strict, bounded, scoped, and immutable", async () => {
  const { validateSourceEnvelope } = await domain();
  const input = sourceEnvelope();
  const validated = validateSourceEnvelope(input, {
    projectId,
    observationCutoff: "2026-09-03T00:00:00.000Z",
    maxItems: 10,
    maxTextChars: 2500,
  });
  assert.equal(validated.projectId, projectId);
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.items), true);
  assert.notEqual(validated, input);
  assert.throws(() => validateSourceEnvelope(sourceEnvelope({ projectId: `prj_${"z".repeat(52)}` }), { projectId }), { code: "SOURCE_SCOPE_MISMATCH" });
  assert.throws(() => validateSourceEnvelope(sourceEnvelope({ extraAuthority: "execute" }), { projectId }), { code: "SOURCE_SCHEMA_INVALID" });
});

test("G1 extraction envelopes require resolvable locators and reject numeric authority", async () => {
  const { validateExtractionEnvelope } = await domain();
  const validated = validateExtractionEnvelope(extractionEnvelope(), {
    sourceEnvelopeDigest: digest,
    sourceLocators: new Set(["turn-1:item-0"]),
  });
  assert.equal(Object.isFrozen(validated), true);
  assert.throws(() => validateExtractionEnvelope(extractionEnvelope({
    claims: [{ kind: "topic", subjectCandidate: "x", modality: "asserted", polarity: "affirm", lifecycle: "active", evidenceLocators: ["missing"] }],
  }), { sourceEnvelopeDigest: digest, sourceLocators: new Set(["turn-1:item-0"]) }), { code: "EXTRACTION_EVIDENCE_MISSING" });
  assert.throws(() => validateExtractionEnvelope(extractionEnvelope({ selectionScore: 0.99 }), {
    sourceEnvelopeDigest: digest,
    sourceLocators: new Set(["turn-1:item-0"]),
  }), { code: "EXTRACTION_SCHEMA_INVALID" });
});

test("G1 graph revisions are deterministic, immutable, and order independent", async () => {
  const { buildGraphRevision } = await domain();
  const first = buildGraphRevision(graphInput());
  const reordered = buildGraphRevision(graphInput({
    nodes: [...graphInput().nodes].reverse(),
    observations: [...graphInput().observations].reverse(),
    relations: [...graphInput().relations].reverse(),
  }));
  assert.equal(first.id, reordered.id);
  assert.equal(first.fingerprint, reordered.fingerprint);
  assert.match(first.id, /^grv_[a-z2-7]{52}$/);
  assert.equal(first.nodes.every((node) => /^nrv_[a-z2-7]{52}$/.test(node.revisionId)), true);
  assert.equal(first.relations.every((relation) => /^rlv_[a-z2-7]{52}$/.test(relation.revisionId)), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.relations[0]), true);
});

test("G1 graph publication rejects broken evidence closure", async () => {
  const { buildGraphRevision } = await domain();
  const input = graphInput();
  input.relations[0].evidenceIds = [`evd_${"d".repeat(52)}`];
  assert.throws(() => buildGraphRevision(input), { code: "EVIDENCE_CLOSURE_BROKEN" });
});

test("G1 graph schemas reject unknown fields and node-kind identity substitution", async () => {
  const { buildGraphRevision } = await domain();
  assert.throws(() => buildGraphRevision(graphInput({ hiddenAuthority: "execute" })), { code: "GRAPH_SCHEMA_INVALID" });
  const wrongNodeIdentity = graphInput();
  wrongNodeIdentity.nodes[2].id = threadId;
  assert.throws(() => buildGraphRevision(wrongNodeIdentity), { code: "NODE_DUPLICATE" });
  wrongNodeIdentity.nodes[2].id = `thr_${"d".repeat(52)}`;
  assert.throws(() => buildGraphRevision(wrongNodeIdentity), { code: "NODE_SCHEMA_INVALID" });
});

test("G1 graph revisions freeze complete supported policies", async () => {
  const { buildGraphRevision } = await domain();
  const incomplete = graphInput();
  delete incomplete.policies.redaction;
  assert.throws(() => buildGraphRevision(incomplete), { code: "GRAPH_POLICY_INVALID" });
  const unsupported = graphInput();
  unsupported.policies.relation = "relation-policy/2";
  assert.throws(() => buildGraphRevision(unsupported), { code: "GRAPH_POLICY_UNSUPPORTED" });
  const mismatchedRelation = graphInput();
  mismatchedRelation.relations[0].policyVersion = "relation-policy/other";
  assert.throws(() => buildGraphRevision(mismatchedRelation), { code: "RELATION_POLICY_MISMATCH" });
});

test("G1 graph publication rejects unauthorized or out-of-scope observations", async () => {
  const { buildGraphRevision } = await domain();
  const unauthorized = graphInput();
  unauthorized.observations[0].authorized = false;
  assert.throws(() => buildGraphRevision(unauthorized), { code: "OBSERVATION_UNAUTHORIZED" });
  const outside = graphInput();
  outside.observations[0].projectId = `prj_${"d".repeat(52)}`;
  assert.throws(() => buildGraphRevision(outside), { code: "OBSERVATION_SCOPE_MISMATCH" });
});

test("G1 inferred current relations require confidence and explanation", async () => {
  const { buildGraphRevision } = await domain();
  const input = graphInput();
  delete input.relations[0].explanation;
  assert.throws(() => buildGraphRevision(input), { code: "INFERRED_RELATION_INVALID" });
});

test("G1 relation lifecycle creates revisions and rejects illegal transitions", async () => {
  const { buildGraphRevision, reviseRelation } = await domain();
  const current = buildGraphRevision(graphInput()).relations[0];
  const invalidated = reviseRelation(current, "invalidated", { code: "SOURCE_CHANGED", evidenceIds: [evidenceId] });
  assert.equal(invalidated.lifecycle, "invalidated");
  assert.equal(invalidated.previousRevisionId, current.revisionId);
  assert.notEqual(invalidated.revisionId, current.revisionId);
  assert.equal(current.lifecycle, "current");
  assert.throws(() => reviseRelation(invalidated, "current", { code: "ILLEGAL" }), { code: "RELATION_TRANSITION_INVALID" });
});

test("G1 evidence invalidation revises only dependent current relations", async () => {
  const { buildGraphRevision, invalidateRelationsByEvidence } = await domain();
  const current = buildGraphRevision(graphInput()).relations[0];
  const unaffected = { ...current, relationKey: `rel_${"e".repeat(52)}`, revisionId: `rlv_${"f".repeat(52)}`, evidenceIds: [`evd_${"d".repeat(52)}`] };
  const result = invalidateRelationsByEvidence([current, unaffected], new Set([evidenceId]), "SOURCE_CHANGED");
  assert.equal(result[0].lifecycle, "invalidated");
  assert.equal(result[1], unaffected);
  assert.equal(current.lifecycle, "current");
});
