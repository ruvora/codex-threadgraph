import { contentAddressedId, fingerprint } from "./domain/hashing.mjs";
import { immutableClone } from "./domain/immutable.mjs";
import { deriveEvidenceId, deriveObservationId } from "./domain/records.mjs";
import { validateExtractionEnvelope, validateSourceEnvelope } from "./domain/envelopes.mjs";

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function normalizeLabel(value) {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

export function resolveSubjects(candidates, acceptedAliases = []) {
  const aliasMap = new Map();
  for (const record of acceptedAliases) {
    const key = `${record.entityKind}:${normalizeLabel(record.alias)}`;
    if (!aliasMap.has(key)) aliasMap.set(key, new Set());
    aliasMap.get(key).add(record.entityId);
  }
  return candidates.map((candidate) => {
    const normalized = normalizeLabel(candidate.subjectCandidate);
    const key = `${candidate.kind}:${normalized}`;
    const matches = aliasMap.get(key) ?? new Set();
    if (matches.size > 1) fail("SUBJECT_MERGE_AMBIGUOUS", "Accepted aliases resolve to multiple canonical entities", { key });
    return Object.freeze({ ...candidate, normalizedSubject: normalized, canonicalSubjectId: matches.size === 1 ? [...matches][0] : null });
  });
}

export function materializeExtraction(sourceInput, extractionInput, { acceptedAliases = [], observationCutoff } = {}) {
  const source = validateSourceEnvelope(sourceInput, {
    projectId: sourceInput.projectId,
    observationCutoff: observationCutoff ?? sourceInput.observedAt,
    maxItems: 1000,
    maxTextChars: 120000,
  });
  const sourceEnvelopeDigest = fingerprint("source-envelope/1", source);
  const extraction = validateExtractionEnvelope(extractionInput, {
    sourceEnvelopeDigest,
    sourceLocators: new Set(source.items.map((item) => item.locator)),
  });
  const observationBase = {
    projectId: source.projectId,
    threadId: source.threadId,
    sourceRange: source.range,
    contentDigest: source.contentDigest,
    redactionVersion: source.redactionPolicy,
    authorized: true,
    observedAt: source.observedAt,
  };
  const observation = { id: deriveObservationId(observationBase), ...observationBase };
  const evidenceByLocator = new Map();
  for (const item of source.items) {
    const base = { observationId: observation.id, itemLocator: item.locator, contentDigest: fingerprint("source-item/1", item) };
    evidenceByLocator.set(item.locator, { id: deriveEvidenceId(base), ...base });
  }
  const resolved = resolveSubjects(extraction.claims, acceptedAliases);
  const claims = resolved.map((claim) => {
    if (["proposed", "questioned", "rejected"].includes(claim.modality) && claim.lifecycle === "active") {
      fail("CLAIM_AUTHORITY_INVALID", "Non-asserted content cannot become an active claim");
    }
    const evidenceIds = claim.evidenceLocators.map((locator) => evidenceByLocator.get(locator).id).sort();
    const canonicalSubject = claim.canonicalSubjectId ?? `label:${claim.kind}:${claim.normalizedSubject}`;
    const id = contentAddressedId("clm_", "codex-threadgraph/claim-id/1", [
      claim.kind,
      canonicalSubject,
      normalizeLabel(claim.predicate ?? ""),
      normalizeLabel(claim.object ?? ""),
      fingerprint("claim-evidence/1", evidenceIds),
      extraction.extractorVersion,
    ]);
    return {
      id,
      kind: claim.kind,
      canonicalSubjectKey: canonicalSubject,
      normalizedSubject: claim.normalizedSubject,
      modality: claim.modality,
      polarity: claim.polarity,
      lifecycle: claim.lifecycle,
      evidenceIds,
      extractorVersion: extraction.extractorVersion,
    };
  });
  return immutableClone({
    sourceEnvelopeDigest,
    observation,
    evidenceItems: [...evidenceByLocator.values()],
    claims,
    warnings: extraction.warnings,
  });
}

export function deriveExactRelations({ scopeId, projectId, threads, artifacts = [] }) {
  const relations = [];
  for (const thread of threads) {
    relations.push({ sourceId: thread.id, targetId: projectId, kind: "belongs_to", evidenceClass: "observed", evidenceIds: [...thread.evidenceIds] });
    if (thread.parentId) {
      if (!threads.some((candidate) => candidate.id === thread.parentId)) fail("LINEAGE_PARENT_MISSING", "Exact lineage parent is not in scope");
      relations.push({ sourceId: thread.id, targetId: thread.parentId, kind: "forked_from", evidenceClass: "observed", evidenceIds: [...thread.evidenceIds] });
    }
  }
  for (const artifact of artifacts) {
    relations.push({ sourceId: artifact.threadId, targetId: artifact.claimId, kind: "produced", evidenceClass: "observed", evidenceIds: [...artifact.evidenceIds] });
  }
  for (const relation of relations) {
    relation.relationKey = contentAddressedId("rel_", "codex-threadgraph/relation-id/1", [scopeId, relation.sourceId, relation.targetId, relation.kind]);
  }
  const lineage = new Map(relations.filter((item) => item.kind === "forked_from").map((item) => [item.sourceId, item.targetId]));
  for (const start of lineage.keys()) {
    const seen = new Set([start]);
    let cursor = lineage.get(start);
    while (cursor) {
      if (seen.has(cursor)) fail("LINEAGE_CYCLE", "Exact lineage must be acyclic");
      seen.add(cursor);
      cursor = lineage.get(cursor);
    }
  }
  return immutableClone(relations.sort((a, b) => a.relationKey.localeCompare(b.relationKey)));
}

export function planIncrementalUpdate(previous, currentSources) {
  const prior = new Map((previous?.sources ?? []).map((source) => [source.threadId, source]));
  const reused = [];
  const changed = [];
  const invalidEvidenceIds = new Set();
  for (const source of currentSources) {
    const old = prior.get(source.threadId);
    if (old?.contentDigest === source.contentDigest && old?.sourceUpdatedAt === source.sourceUpdatedAt) reused.push(source.threadId);
    else {
      changed.push(source.threadId);
      for (const id of old?.evidenceIds ?? []) invalidEvidenceIds.add(id);
    }
  }
  return immutableClone({ reused: reused.sort(), changed: changed.sort(), invalidEvidenceIds: [...invalidEvidenceIds].sort() });
}
