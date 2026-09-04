import { randomBytes } from "node:crypto";
import { authorizeIndexUpdate } from "./contracts/index-trigger.mjs";
import { buildGraphRevision } from "./domain/graph-revision.mjs";
import { contentAddressedId, fingerprint } from "./domain/hashing.mjs";
import { immutableClone } from "./domain/immutable.mjs";
import { materializeExtraction } from "./extraction.mjs";
import { evaluateInference, generateRelationCandidates } from "./inference.mjs";
import { DEFAULT_BUDGET, ScopedSourceAdapter } from "./source-adapter.mjs";

const policies = Object.freeze({
  schema: "graph-schema/1-alpha",
  identity: "id-policy/1-alpha",
  index: "index-policy/1-alpha",
  extraction: "extractor/1-alpha",
  normalization: "normalization/1-alpha",
  relation: "relation-policy/1-alpha",
  redaction: "redaction/1-alpha",
});

function fail(code, message, details = {}) { const error = new Error(message); error.code = code; error.details = details; throw error; }
function canonicalTime(value) {
  if (typeof value === "number") return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function uuidV7(nowMs = Date.now()) {
  const timestamp = BigInt(nowMs);
  const random = randomBytes(10);
  const bytes = Buffer.alloc(16);
  for (let index = 5; index >= 0; index -= 1) bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xffn);
  random.copy(bytes, 6);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `ent_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function metadataEnvelope(member, observedAt) {
  const sourceUpdatedAt = canonicalTime(member.updatedAt) ?? observedAt;
  if (Date.parse(sourceUpdatedAt) > Date.parse(observedAt)) fail("SOURCE_CUTOFF_EXCEEDED", "Thread metadata follows the frozen cutoff", { nativeThreadId: member.nativeThreadId });
  const item = {
    locator: "metadata:item-0",
    role: "tool",
    type: "native_metadata",
    text: `Native thread ${member.nativeThreadId}; availability ${member.availability}; parent ${member.parentNativeThreadId ?? "none"}.`,
  };
  return {
    schemaVersion: "source-envelope/1-alpha",
    projectId: member.projectId,
    threadId: member.id,
    nativeThreadId: member.nativeThreadId,
    range: { startTurnId: "metadata", endTurnId: "metadata", itemIndexes: [0] },
    observedAt,
    sourceUpdatedAt,
    contentDigest: fingerprint("source-envelope-content/1", [item]),
    redactionPolicy: "redaction/1-alpha",
    coverage: member.availability === "readable" ? "metadata_only" : member.availability,
    items: [item],
  };
}

function emptyExtraction(source) {
  return {
    schemaVersion: "extraction/1-alpha",
    sourceEnvelopeDigest: fingerprint("source-envelope/1", source),
    extractorVersion: "extractor/1-alpha",
    claims: [], aliases: [], relationCandidates: [], warnings: [],
  };
}

function addRelation(map, relation) {
  const key = `${relation.sourceId}\u0000${relation.targetId}\u0000${relation.kind}`;
  const existing = map.get(key);
  if (!existing) map.set(key, { ...relation, evidenceIds: [...new Set(relation.evidenceIds)].sort() });
  else existing.evidenceIds = [...new Set([...existing.evidenceIds, ...relation.evidenceIds])].sort();
}

export class IndexingPipeline {
  #registry;
  #host;
  #hostId;
  #canonicalProjectId;
  #budget;
  #workerId;
  #sessionTtlMs;
  #active = new Map();

  constructor({ registry, host, hostId, canonicalProjectId, budget = {}, workerId = "threadgraph-mcp", sessionTtlMs = 10 * 60 * 1000 }) {
    this.#registry = registry;
    this.#host = host;
    this.#hostId = hostId;
    this.#canonicalProjectId = canonicalProjectId;
    this.#budget = { ...DEFAULT_BUDGET, ...budget };
    this.#workerId = workerId;
    this.#sessionTtlMs = sessionTtlMs;
  }

  async prepare({ triggerKind, requestOrigin, observationCutoff = new Date().toISOString() }) {
    const cutoff = canonicalTime(observationCutoff);
    if (!cutoff) fail("GRAPH_CUTOFF_INVALID", "A canonical observation cutoff is required");
    const adapter = new ScopedSourceAdapter({ host: this.#host, hostId: this.#hostId, canonicalProjectId: this.#canonicalProjectId, budget: this.#budget });
    const scopeId = adapter.scopeId;
    const current = this.#registry.currentRevision(scopeId);
    const decision = authorizeIndexUpdate({
      trigger: triggerKind,
      projectId: scopeId,
      selectedProjectId: scopeId,
      hasPublishedRevision: Boolean(current),
      userInitiated: triggerKind === "explicit_refresh",
    });
    if (decision.decision !== "allow") fail(decision.code, "Indexing trigger is not authorized", { nextAction: decision.nextAction });
    const request = { scopeId, triggerKind, requestOrigin, observationCutoff: cutoff, parentRevisionId: current?.id ?? null, budget: this.#budget, policies };
    const requestFingerprint = fingerprint("index-request/2", request);
    if (this.#active.has(requestFingerprint)) return this.#active.get(requestFingerprint);
    const operation = this.#prepareAuthorized(adapter, request, requestFingerprint).finally(() => this.#active.delete(requestFingerprint));
    this.#active.set(requestFingerprint, operation);
    return operation;
  }

  async #prepareAuthorized(adapter, request, requestFingerprint) {
    const lease = this.#registry.acquireLease(request.scopeId, this.#workerId, this.#sessionTtlMs);
    const jobId = this.#registry.createJob({ scopeId: request.scopeId, requestFingerprint, triggerKind: request.triggerKind });
    try {
      this.#registry.transitionJob(jobId, "reading");
      const members = await adapter.enumerate();
      const sources = [];
      const semanticSourceIds = [];
      for (const [index, member] of members.entries()) {
        if (index < this.#budget.maxDeepReads && member.availability === "readable") {
          const read = await adapter.read(member.nativeThreadId, request.observationCutoff);
          if (read.schemaVersion) {
            sources.push(read);
            semanticSourceIds.push(read.threadId);
            continue;
          }
          sources.push(metadataEnvelope(read, request.observationCutoff));
        } else sources.push(metadataEnvelope(member, request.observationCutoff));
      }
      const sourceDigest = fingerprint("index-sources/1", sources);
      const sessionId = contentAddressedId("idx_", "codex-threadgraph/index-session-id/1", [requestFingerprint, sourceDigest]);
      const expiresAt = Date.now() + this.#sessionTtlMs;
      const payload = { request, members, sources, semanticSourceIds };
      const session = this.#registry.createIndexSession({ sessionId, scopeId: request.scopeId, jobId, requestFingerprint, sourceDigest, observationCutoff: request.observationCutoff, payload, lease, expiresAt });
      this.#registry.transitionJob(jobId, "extracting");
      return immutableClone({
        sessionId,
        scopeId: request.scopeId,
        requestFingerprint,
        sourceDigest,
        observationCutoff: request.observationCutoff,
        expiresAt,
        sources: sources.filter((source) => semanticSourceIds.includes(source.threadId)),
        omittedSemanticSources: sources.length - semanticSourceIds.length,
        status: session.status,
      });
    } catch (error) {
      try { this.#registry.transitionJob(jobId, "failed", { code: error.code ?? "SOURCE_FAILURE", message: error.message }); } catch {}
      throw error;
    }
  }

  async publish({ sessionId, extractions }) {
    const session = this.#registry.getIndexSession(sessionId);
    if (!session) fail("INDEX_SESSION_NOT_FOUND", "Index session does not exist");
    if (session.status !== "prepared") fail("INDEX_SESSION_TERMINAL", "Index session is not publishable");
    try {
      this.#validateSession(session);
      await this.#revalidateScope(session);
      const extractionMap = new Map();
      for (const extraction of extractions ?? []) {
        if (extractionMap.has(extraction.sourceEnvelopeDigest)) fail("EXTRACTION_DUPLICATE", "Only one extraction is allowed per source envelope");
        extractionMap.set(extraction.sourceEnvelopeDigest, extraction);
      }
      const allowedDigests = new Set(session.payload.sources.filter((source) => session.payload.semanticSourceIds.includes(source.threadId)).map((source) => fingerprint("source-envelope/1", source)));
      for (const digest of extractionMap.keys()) if (!allowedDigests.has(digest)) fail("EXTRACTION_SOURCE_MISMATCH", "Extraction was not prepared by this session");
      if (extractionMap.size !== allowedDigests.size) fail("EXTRACTION_INCOMPLETE", "Every semantic source requires one Extraction Envelope");
      this.#registry.transitionJob(session.jobId, "linking");
      const revision = this.#buildRevision(session, extractionMap);
      this.#registry.transitionJob(session.jobId, "validating");
      const published = this.#registry.publishIndexSession(sessionId, revision);
      return immutableClone({ sessionId, status: published.status, revisionId: published.resultRevisionId, graph: this.#registry.currentRevision(session.scopeId) });
    } catch (error) {
      const active = this.#registry.getIndexSession(sessionId);
      if (active && ["prepared", "publishing"].includes(active.status)) {
        this.#registry.failIndexSession(sessionId, { code: error.code ?? "INDEX_VALIDATION_FAILED", message: error.message });
      }
      throw error;
    }
  }

  cancel(sessionId) { return this.#registry.cancelIndexSession(sessionId); }

  #validateSession(session) {
    if (session.expiresAt <= Date.now()) fail("INDEX_SESSION_EXPIRED", "Index session has expired");
    if (fingerprint("index-request/2", session.payload.request) !== session.requestFingerprint) fail("INDEX_SESSION_FINGERPRINT_MISMATCH", "Prepared request was modified");
    if (fingerprint("index-sources/1", session.payload.sources) !== session.sourceDigest) fail("INDEX_SESSION_SOURCE_MISMATCH", "Prepared sources were modified");
    if (session.payload.request.scopeId !== session.scopeId || session.payload.request.observationCutoff !== session.observationCutoff) fail("INDEX_SESSION_SCOPE_MISMATCH", "Prepared scope or cutoff was modified");
  }

  async #revalidateScope(session) {
    const adapter = new ScopedSourceAdapter({ host: this.#host, hostId: this.#hostId, canonicalProjectId: this.#canonicalProjectId, budget: this.#budget });
    if (adapter.scopeId !== session.scopeId) fail("INDEX_SESSION_SCOPE_MISMATCH", "Host scope identity changed");
    const currentMembers = await adapter.enumerate();
    const visible = new Set(currentMembers.map((member) => member.nativeThreadId));
    for (const member of session.payload.members) if (!visible.has(member.nativeThreadId)) fail("SOURCE_SCOPE_REVALIDATION_FAILED", "Prepared thread is no longer visible in the authorized scope", { nativeThreadId: member.nativeThreadId });
  }

  #buildRevision(session, extractionMap) {
    const observations = [];
    const evidenceItems = [];
    const nodes = new Map();
    const relations = new Map();
    const profiles = new Map();
    const evidenceByThread = new Map();
    for (const source of session.payload.sources) {
      const digest = fingerprint("source-envelope/1", source);
      const extraction = extractionMap.get(digest) ?? emptyExtraction(source);
      const result = materializeExtraction(source, extraction, { observationCutoff: session.observationCutoff });
      observations.push(result.observation);
      evidenceItems.push(...result.evidenceItems);
      const sourceEvidence = result.evidenceItems.map((item) => item.id);
      evidenceByThread.set(source.threadId, sourceEvidence);
      const profile = { id: source.threadId, projectId: session.scopeId, topicIds: [], activeDecisionIds: [], artifactIds: [], activeConstraintIds: [], referenceIds: [], evidenceIds: sourceEvidence, observationId: result.observation.id };
      profiles.set(source.threadId, profile);
      for (const claim of result.claims) {
        const nodeId = claim.kind === "topic"
          ? this.#registry.resolveSemanticEntity(session.scopeId, claim.canonicalSubjectKey, () => uuidV7())
          : claim.id;
        const nodeKind = claim.kind;
        const existing = nodes.get(nodeId);
        if (!existing) nodes.set(nodeId, { id: nodeId, kind: nodeKind, scopeId: session.scopeId, canonicalSubjectKey: claim.canonicalSubjectKey, lifecycle: "current", evidenceIds: [...claim.evidenceIds] });
        else existing.evidenceIds = [...new Set([...existing.evidenceIds, ...claim.evidenceIds])].sort();
        if (claim.kind === "topic") profile.topicIds.push(nodeId);
        if (claim.kind === "decision" && claim.lifecycle === "active") profile.activeDecisionIds.push(nodeId);
        if (claim.kind === "constraint" && claim.lifecycle === "active") profile.activeConstraintIds.push(nodeId);
        if (claim.kind === "artifact") profile.artifactIds.push(nodeId);
        addRelation(relations, {
          sourceId: source.threadId,
          targetId: nodeId,
          kind: claim.kind === "artifact" ? "produced" : claim.kind === "result" ? "validated" : "references",
          evidenceClass: "extracted",
          evidenceIds: claim.evidenceIds,
          confidenceBand: null,
          policyVersion: policies.relation,
          lifecycle: "current",
        });
      }
    }
    const allEvidence = evidenceItems.map((item) => item.id);
    if (allEvidence.length > 0) nodes.set(session.scopeId, { id: session.scopeId, kind: "project", scopeId: session.scopeId, canonicalSubjectKey: session.scopeId, lifecycle: "current", evidenceIds: allEvidence });
    const memberByNative = new Map(session.payload.members.map((member) => [member.nativeThreadId, member]));
    for (const member of session.payload.members) {
      const evidenceIds = evidenceByThread.get(member.id);
      if (!evidenceIds?.length) continue;
      nodes.set(member.id, { id: member.id, kind: "thread", nativeThreadId: member.nativeThreadId, scopeId: session.scopeId, canonicalSubjectKey: member.id, lifecycle: "current", evidenceIds });
      addRelation(relations, { sourceId: member.id, targetId: session.scopeId, kind: "belongs_to", evidenceClass: "observed", evidenceIds, confidenceBand: null, policyVersion: policies.relation, lifecycle: "current" });
      const parent = memberByNative.get(member.parentNativeThreadId);
      if (parent && evidenceByThread.has(parent.id)) addRelation(relations, { sourceId: member.id, targetId: parent.id, kind: "forked_from", evidenceClass: "observed", evidenceIds, confidenceBand: null, policyVersion: policies.relation, lifecycle: "current" });
    }
    const blocked = generateRelationCandidates([...profiles.values()]);
    for (const candidate of blocked.candidates) {
      const left = profiles.get(candidate.leftId);
      const right = profiles.get(candidate.rightId);
      const evidenceIds = [...new Set([...left.evidenceIds, ...right.evidenceIds])].sort();
      const sharedSubject = [...candidate.keys.decisions, ...candidate.keys.artifacts, ...candidate.keys.constraints, ...candidate.keys.topics][0];
      const inferred = evaluateInference(candidate, { kind: "related_to", evidenceIds, hasEvidenceClosure: true, independenceKeys: [left.observationId, right.observationId], concreteSubject: sharedSubject ?? "native lineage", explanation: `Shared evidence key ${sharedSubject ?? "native lineage"}.`, alternatives: [], inferenceVersion: "inference/1-alpha" });
      if (inferred.decision === "allow") addRelation(relations, { sourceId: inferred.sourceId, targetId: inferred.targetId, kind: inferred.kind, evidenceClass: inferred.evidenceClass, evidenceIds: inferred.evidenceIds, confidenceBand: inferred.confidenceBand, explanation: inferred.explanation, inferenceVersion: inferred.inferenceVersion, alternatives: inferred.alternatives, policyVersion: policies.relation, lifecycle: "current" });
    }
    return buildGraphRevision({
      scopeId: session.scopeId,
      parentRevisionId: session.payload.request.parentRevisionId,
      observationCutoff: session.observationCutoff,
      policies,
      observations,
      evidenceItems,
      nodes: [...nodes.values()],
      relations: [...relations.values()],
    });
  }
}

export { policies as INDEXING_POLICIES };
