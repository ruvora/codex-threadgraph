import { fail } from "./errors.mjs";
import { contentAddressedId, fingerprint } from "./hashing.mjs";
import { immutableClone } from "./immutable.mjs";
import { assertTypedId, isTypedId } from "./ids.mjs";
import { deriveEvidenceId, deriveObservationId } from "./records.mjs";
import { deriveRelationRevisionId } from "./relation-lifecycle.mjs";

const nodeKinds = new Set(["project", "thread", "topic", "decision", "constraint", "artifact", "result"]);
const inferredKinds = new Set(["related_to", "continues", "contradicts", "supersedes", "specializes_in"]);
const exactKinds = new Set(["belongs_to", "forked_from", "produced", "validated", "references"]);
const confidenceBands = new Set(["high", "medium", "low"]);
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const graphKeys = new Set(["scopeId", "parentRevisionId", "observationCutoff", "policies", "observations", "evidenceItems", "nodes", "relations"]);
const observationKeys = new Set(["id", "projectId", "threadId", "sourceRange", "contentDigest", "redactionVersion", "authorized", "observedAt"]);
const evidenceKeys = new Set(["id", "observationId", "itemLocator", "contentDigest"]);
const nodeKeys = new Set(["id", "kind", "scopeId", "canonicalSubjectKey", "lifecycle", "evidenceIds"]);
const relationKeys = new Set([
  "sourceId", "targetId", "kind", "evidenceClass", "evidenceIds", "confidenceBand", "explanation",
  "inferenceVersion", "alternatives", "policyVersion", "lifecycle",
]);
const nodeIdKinds = {
  project: "project",
  thread: "thread",
  topic: "entity",
  decision: "claim",
  constraint: "claim",
  artifact: "claim",
  result: "claim",
};
const supportedPolicies = {
  schema: "graph-schema/1-alpha",
  identity: "id-policy/1-alpha",
  index: "index-policy/1-alpha",
  extraction: "extractor/1-alpha",
  normalization: "normalization/1-alpha",
  relation: "relation-policy/1-alpha",
  redaction: "redaction/1-alpha",
};

function requireExactKeys(value, allowed, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code, "Record must be an object");
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) fail(code, "Record contains unknown fields", { unknown });
}

function requireArray(value, code, field) {
  if (!Array.isArray(value)) fail(code, `${field} must be an array`);
}

function uniqueMap(items, key, code) {
  const result = new Map();
  for (const item of items) {
    if (result.has(item[key])) fail(code, `${key} must be unique`, { value: item[key] });
    result.set(item[key], item);
  }
  return result;
}

function ensureEvidenceClosure(evidenceIds, evidenceMap, observationMap) {
  if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) fail("EVIDENCE_CLOSURE_BROKEN", "Current records require evidence");
  for (const evidenceId of evidenceIds) {
    assertTypedId(evidenceId, "evidence");
    const evidence = evidenceMap.get(evidenceId);
    if (!evidence || !observationMap.has(evidence.observationId)) {
      fail("EVIDENCE_CLOSURE_BROKEN", "Evidence path does not resolve", { evidenceId });
    }
  }
}

function buildNodeRevision(node, input, evidenceMap, observationMap) {
  requireExactKeys(node, nodeKeys, "NODE_SCHEMA_INVALID");
  if (!nodeKinds.has(node.kind) || !isTypedId(node.id, nodeIdKinds[node.kind]) || node.scopeId !== input.scopeId) fail("NODE_SCHEMA_INVALID", "Node identity, kind, or scope is invalid");
  if (node.lifecycle !== "current" || typeof node.canonicalSubjectKey !== "string" || node.canonicalSubjectKey.length === 0) fail("NODE_SCHEMA_INVALID", "Current node fields are invalid");
  ensureEvidenceClosure(node.evidenceIds, evidenceMap, observationMap);
  const evidenceDigest = fingerprint("node-evidence/1", [...node.evidenceIds].sort());
  const attributesDigest = fingerprint("node-attributes/1", {
    id: node.id,
    kind: node.kind,
    scopeId: node.scopeId,
    canonicalSubjectKey: node.canonicalSubjectKey,
    lifecycle: node.lifecycle,
  });
  const revisionId = contentAddressedId("nrv_", "codex-threadgraph/node-revision-id/1", [
    node.id,
    evidenceDigest,
    attributesDigest,
    input.policies.schema,
  ]);
  return { ...structuredClone(node), evidenceIds: [...node.evidenceIds].sort(), revisionId };
}

function buildRelationRevision(relation, input, nodeIds, evidenceMap, observationMap) {
  requireExactKeys(relation, relationKeys, "RELATION_SCHEMA_INVALID");
  if (!nodeIds.has(relation?.sourceId) || !nodeIds.has(relation?.targetId)) fail("RELATION_ENDPOINT_MISSING", "Relation endpoints must exist in the revision");
  if (![...exactKinds, ...inferredKinds].includes(relation.kind) || relation.lifecycle !== "current") fail("RELATION_SCHEMA_INVALID", "Relation kind or lifecycle is invalid");
  if (relation.policyVersion !== input.policies.relation) fail("RELATION_POLICY_MISMATCH", "Relation policy differs from the frozen graph policy");
  ensureEvidenceClosure(relation.evidenceIds, evidenceMap, observationMap);
  if (exactKinds.has(relation.kind) && !["observed", "extracted"].includes(relation.evidenceClass)) fail("EXACT_RELATION_INVALID", "Exact relations require direct evidence");
  if (inferredKinds.has(relation.kind)) {
    if (
      relation.evidenceClass !== "inferred"
      || !confidenceBands.has(relation.confidenceBand)
      || typeof relation.explanation !== "string"
      || relation.explanation.length === 0
      || typeof relation.inferenceVersion !== "string"
      || relation.inferenceVersion.length === 0
      || !Array.isArray(relation.alternatives)
    ) fail("INFERRED_RELATION_INVALID", "Inferred relation metadata is incomplete");
  }
  const relationKey = contentAddressedId("rel_", "codex-threadgraph/relation-id/1", [
    input.scopeId,
    relation.sourceId,
    relation.targetId,
    relation.kind,
  ]);
  const candidate = {
    ...structuredClone(relation),
    relationKey,
    evidenceIds: [...relation.evidenceIds].sort(),
  };
  candidate.revisionId = deriveRelationRevisionId(candidate);
  return candidate;
}

export function buildGraphRevision(input) {
  requireExactKeys(input, graphKeys, "GRAPH_SCHEMA_INVALID");
  assertTypedId(input?.scopeId, "project");
  if (input.parentRevisionId !== null) assertTypedId(input.parentRevisionId, "graphRevision");
  if (!input.policies || typeof input.policies !== "object" || Array.isArray(input.policies)) fail("GRAPH_POLICY_INVALID", "Versioned policies are required");
  const policyKeys = Object.keys(input.policies).sort();
  if (JSON.stringify(policyKeys) !== JSON.stringify(Object.keys(supportedPolicies).sort())) fail("GRAPH_POLICY_INVALID", "The complete frozen policy set is required");
  for (const [name, version] of Object.entries(supportedPolicies)) {
    if (input.policies[name] !== version) fail("GRAPH_POLICY_UNSUPPORTED", `Unsupported ${name} policy`, { version: input.policies[name] });
  }
  if (
    typeof input.observationCutoff !== "string"
    || Number.isNaN(Date.parse(input.observationCutoff))
    || new Date(input.observationCutoff).toISOString() !== input.observationCutoff
  ) fail("GRAPH_CUTOFF_INVALID", "Observation cutoff is required");
  for (const field of ["observations", "evidenceItems", "nodes", "relations"]) requireArray(input[field], "GRAPH_SCHEMA_INVALID", field);

  const observationMap = uniqueMap(input.observations, "id", "OBSERVATION_DUPLICATE");
  for (const observation of observationMap.values()) {
    requireExactKeys(observation, observationKeys, "OBSERVATION_SCHEMA_INVALID");
    assertTypedId(observation.id, "observation");
    assertTypedId(observation.threadId, "thread");
    if (observation.projectId !== input.scopeId) fail("OBSERVATION_SCOPE_MISMATCH", "Observation is outside the graph scope");
    if (observation.authorized !== true) fail("OBSERVATION_UNAUTHORIZED", "Observation was not authorized for reading");
    if (!digestPattern.test(observation.contentDigest) || !observation.sourceRange || typeof observation.redactionVersion !== "string") fail("OBSERVATION_SCHEMA_INVALID", "Observation provenance is incomplete");
    if (
      typeof observation.observedAt !== "string"
      || Number.isNaN(Date.parse(observation.observedAt))
      || new Date(observation.observedAt).toISOString() !== observation.observedAt
    ) fail("OBSERVATION_SCHEMA_INVALID", "Observation timestamp is invalid");
    if (deriveObservationId(observation) !== observation.id) fail("OBSERVATION_ID_MISMATCH", "Observation ID does not match provenance");
    if (Date.parse(observation.observedAt) > Date.parse(input.observationCutoff)) fail("OBSERVATION_CUTOFF_EXCEEDED", "Observation follows the graph cutoff");
  }

  const evidenceMap = uniqueMap(input.evidenceItems, "id", "EVIDENCE_DUPLICATE");
  for (const evidence of evidenceMap.values()) {
    requireExactKeys(evidence, evidenceKeys, "EVIDENCE_SCHEMA_INVALID");
    assertTypedId(evidence.id, "evidence");
    assertTypedId(evidence.observationId, "observation");
    if (!observationMap.has(evidence.observationId) || !digestPattern.test(evidence.contentDigest) || !evidence.itemLocator) fail("EVIDENCE_CLOSURE_BROKEN", "Evidence provenance is incomplete");
    if (deriveEvidenceId(evidence) !== evidence.id) fail("EVIDENCE_ID_MISMATCH", "Evidence ID does not match provenance");
  }

  const nodeIds = new Set();
  const nodes = input.nodes.map((node) => {
    if (nodeIds.has(node.id)) fail("NODE_DUPLICATE", "Node IDs must be unique");
    nodeIds.add(node.id);
    return buildNodeRevision(node, input, evidenceMap, observationMap);
  }).sort((left, right) => left.revisionId.localeCompare(right.revisionId));
  const relations = input.relations.map((relation) => buildRelationRevision(relation, input, nodeIds, evidenceMap, observationMap))
    .sort((left, right) => left.revisionId.localeCompare(right.revisionId));
  uniqueMap(relations, "relationKey", "RELATION_DUPLICATE");

  const policyFingerprint = fingerprint("graph-policies/1", input.policies);
  const preimage = {
    scopeId: input.scopeId,
    parentRevisionId: input.parentRevisionId,
    observationCutoff: new Date(input.observationCutoff).toISOString(),
    policyFingerprint,
    nodeRevisionIds: nodes.map((node) => node.revisionId),
    relationRevisionIds: relations.map((relation) => relation.revisionId),
  };
  const id = contentAddressedId("grv_", "codex-threadgraph/graph-revision-id/1", [
    preimage.scopeId,
    preimage.parentRevisionId ?? "null",
    preimage.observationCutoff,
    preimage.policyFingerprint,
    ...preimage.nodeRevisionIds,
    ...preimage.relationRevisionIds,
  ]);
  const result = {
    id,
    fingerprint: fingerprint("graph-revision/1", preimage),
    ...preimage,
    policies: structuredClone(input.policies),
    observations: [...input.observations]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((observation) => structuredClone(observation)),
    evidenceItems: [...input.evidenceItems]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((evidence) => structuredClone(evidence)),
    nodes: nodes.map((node) => ({ ...node, includedInRevisionId: id })),
    relations: relations.map((relation) => ({ ...relation, includedInRevisionId: id })),
  };
  return immutableClone(result);
}
