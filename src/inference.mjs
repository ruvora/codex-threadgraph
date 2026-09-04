import { deriveConfidenceBand, deriveRelationStrength } from "./contracts/derivation.mjs";
import { validateRelation } from "./contracts/relations.mjs";
import { immutableClone } from "./domain/immutable.mjs";

const MAX_CANDIDATES = 1000;

function shared(left = [], right = []) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter((value) => rightSet.has(value)).sort();
}

export function generateRelationCandidates(threads, maxCandidates = MAX_CANDIDATES) {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 0 || maxCandidates > MAX_CANDIDATES) throw Object.assign(new Error("Candidate budget invalid"), { code: "INFERENCE_BUDGET_INVALID" });
  const candidates = [];
  const ordered = [...threads].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < ordered.length; i += 1) {
    for (let j = i + 1; j < ordered.length; j += 1) {
      const left = ordered[i];
      const right = ordered[j];
      if (left.projectId !== right.projectId) continue;
      const keys = {
        decisions: shared(left.activeDecisionIds, right.activeDecisionIds),
        artifacts: shared(left.artifactIds, right.artifactIds),
        constraints: shared(left.activeConstraintIds, right.activeConstraintIds),
        references: shared(left.referenceIds, right.referenceIds),
        topics: shared(left.topicIds, right.topicIds),
      };
      const exactLineage = left.parentId === right.id || right.parentId === left.id;
      if (!exactLineage && Object.values(keys).every((items) => items.length === 0)) continue;
      const strength = deriveRelationStrength({
        exactNativeLineage: exactLineage,
        sharedActiveDecisions: keys.decisions.length,
        sharedArtifactIdentities: keys.artifacts.length,
        sharedActiveConstraints: keys.constraints.length,
        explicitCrossReferences: keys.references.length,
        sharedCanonicalTopics: keys.topics.length,
      });
      candidates.push({ leftId: left.id, rightId: right.id, exactLineage, keys, strength });
    }
  }
  candidates.sort((a, b) => {
    const exact = Number(b.exactLineage) - Number(a.exactLineage);
    if (exact) return exact;
    const points = b.strength.points - a.strength.points;
    return points || `${a.leftId}:${a.rightId}`.localeCompare(`${b.leftId}:${b.rightId}`);
  });
  return immutableClone({ candidates: candidates.slice(0, maxCandidates), omittedCount: Math.max(0, candidates.length - maxCandidates) });
}

export function evaluateInference(candidate, semantic) {
  const evidenceIds = [...new Set(semantic.evidenceIds ?? [])].sort();
  if (evidenceIds.length === 0 || semantic.hasEvidenceClosure !== true) {
    return immutableClone({ decision: "reject", code: "EVIDENCE_CLOSURE_BROKEN", lifecycle: "candidate" });
  }
  let relationDecision;
  if (semantic.kind === "related_to") {
    relationDecision = candidate.strength.strength !== "absent"
      ? { decision: "allow", kind: "related_to", lifecycle: "current" }
      : { decision: "reject", code: "RELATION_EVIDENCE_MISSING", lifecycle: "candidate" };
  } else {
    relationDecision = validateRelation({ ...semantic, kind: semantic.kind });
  }
  if (relationDecision.decision !== "allow") return immutableClone(relationDecision);
  const confidence = deriveConfidenceBand({
    hasEvidenceClosure: true,
    semanticRuleSatisfied: true,
    hasUnresolvedCounterEvidence: semantic.hasUnresolvedCounterEvidence === true,
    independentDirectRanges: new Set(semantic.independenceKeys ?? []).size,
    hasConcreteSubject: typeof semantic.concreteSubject === "string" && semantic.concreteSubject.length > 0,
    hasIndependentCorroboration: candidate.strength.categories >= 2,
    hostSummaryOnly: semantic.hostSummaryOnly === true,
  });
  if (confidence.band === "rejected") return immutableClone({ decision: "reject", code: "CONFIDENCE_REJECTED", lifecycle: "candidate" });
  return immutableClone({
    decision: "allow",
    sourceId: semantic.sourceId ?? candidate.leftId,
    targetId: semantic.targetId ?? candidate.rightId,
    kind: relationDecision.kind,
    evidenceClass: "inferred",
    evidenceIds,
    confidenceBand: confidence.band,
    confidencePolicyVersion: confidence.policyVersion,
    relationStrength: candidate.strength,
    explanation: semantic.explanation,
    alternatives: [...(semantic.alternatives ?? [])],
    inferenceVersion: semantic.inferenceVersion,
    lifecycle: "current",
  });
}

export { MAX_CANDIDATES };
