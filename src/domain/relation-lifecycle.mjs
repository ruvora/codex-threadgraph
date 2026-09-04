import { fail } from "./errors.mjs";
import { contentAddressedId, fingerprint } from "./hashing.mjs";
import { immutableClone } from "./immutable.mjs";
import { assertTypedId } from "./ids.mjs";

const transitions = {
  candidate: new Set(["current", "rejected", "invalidated"]),
  current: new Set(["superseded", "invalidated"]),
  superseded: new Set(),
  invalidated: new Set(),
  rejected: new Set(),
};

export function deriveRelationRevisionId(relation) {
  const evidenceDigest = fingerprint("relation-evidence/1", [...relation.evidenceIds].sort());
  const attributesDigest = fingerprint("relation-attributes/1", {
    sourceId: relation.sourceId,
    targetId: relation.targetId,
    kind: relation.kind,
    evidenceClass: relation.evidenceClass,
    confidenceBand: relation.confidenceBand ?? null,
    explanation: relation.explanation ?? null,
    inferenceVersion: relation.inferenceVersion ?? null,
    alternatives: relation.alternatives ?? [],
    transitionReason: relation.transitionReason ?? null,
    transitionEvidenceIds: relation.transitionEvidenceIds ?? [],
    previousRevisionId: relation.previousRevisionId ?? null,
  });
  return contentAddressedId("rlv_", "codex-threadgraph/relation-revision-id/1", [
    relation.relationKey,
    evidenceDigest,
    relation.policyVersion,
    relation.lifecycle,
    attributesDigest,
  ]);
}

export function reviseRelation(relation, nextLifecycle, reason) {
  assertTypedId(relation?.relationKey, "relation");
  assertTypedId(relation?.revisionId, "relationRevision");
  if (!transitions[relation.lifecycle]?.has(nextLifecycle)) {
    fail("RELATION_TRANSITION_INVALID", `Cannot transition ${relation.lifecycle} to ${nextLifecycle}`);
  }
  if (!reason || typeof reason.code !== "string" || reason.code.length === 0 || !Array.isArray(reason.evidenceIds)) {
    fail("RELATION_TRANSITION_REASON_REQUIRED", "Relation transition requires a structured reason");
  }
  const revised = {
    ...structuredClone(relation),
    lifecycle: nextLifecycle,
    previousRevisionId: relation.revisionId,
    transitionReason: reason.code,
    transitionEvidenceIds: [...reason.evidenceIds].sort(),
  };
  delete revised.includedInRevisionId;
  revised.revisionId = deriveRelationRevisionId(revised);
  return immutableClone(revised);
}

export function invalidateRelationsByEvidence(relations, invalidEvidenceIds, reasonCode) {
  return relations.map((relation) => {
    const dependsOnInvalidEvidence = relation.lifecycle === "current"
      && relation.evidenceIds.some((id) => invalidEvidenceIds.has(id));
    if (!dependsOnInvalidEvidence) return relation;
    const transitionEvidenceIds = relation.evidenceIds.filter((id) => invalidEvidenceIds.has(id));
    return reviseRelation(relation, "invalidated", { code: reasonCode, evidenceIds: transitionEvidenceIds });
  });
}
