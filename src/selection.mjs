import { deriveSelectionScore } from "./contracts/derivation.mjs";
import { contentAddressedId, fingerprint } from "./domain/hashing.mjs";
import { immutableClone } from "./domain/immutable.mjs";

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

export function buildGoalQuery({ graphRevisionId, scopeId, objective, requirements, observationCutoff, anchorThreadIds = [] }) {
  if (typeof objective !== "string" || !objective.trim()) fail("GOAL_QUERY_INVALID", "Objective is required");
  if (!Array.isArray(requirements) || !requirements.some((item) => item.importance === "required" && typeof item.sourceSpan === "string" && item.sourceSpan.length > 0)) {
    return immutableClone({ result: "incomplete", nextAction: "clarify_required_subject", graphRevisionId });
  }
  const normalized = requirements.map((item) => ({ ...item, subject: String(item.subject).normalize("NFKC").trim().toLowerCase() }));
  const id = contentAddressedId("qry_", "codex-threadgraph/goal-query-id/1", [graphRevisionId, objective.trim(), fingerprint("requirements/1", normalized), "query-policy/1-alpha"]);
  return immutableClone({ id, graphRevisionId, scopeId, objective: objective.trim(), requirements: normalized, observationCutoff, anchorThreadIds: [...new Set(anchorThreadIds)].sort(), policyVersion: "query-policy/1-alpha" });
}

function eligible(candidate, query) {
  if (candidate.projectId !== query.scopeId || !candidate.nativeThreadId || candidate.deleted === true || candidate.superseded === true) return false;
  if (candidate.projectConflict === true || candidate.lineageConflict === true) return false;
  return true;
}

export function buildSelectionReport(query, candidates) {
  if (query.result === "incomplete") return query;
  const evaluated = [];
  let sourceIncomplete = false;
  for (const candidate of candidates) {
    if (!eligible(candidate, query)) continue;
    if (candidate.requiredEvidenceUnavailable === true) sourceIncomplete = true;
    const dimensions = candidate.dimensions;
    const score = deriveSelectionScore(dimensions);
    if (score.decision === "reject") fail(score.code, "Invalid selection dimensions");
    evaluated.push({
      threadId: candidate.threadId,
      nativeThreadId: candidate.nativeThreadId,
      score: score.score,
      dimensions: structuredClone(dimensions),
      evidenceIds: [...new Set(candidate.evidenceIds ?? [])].sort(),
      conflicts: [...(candidate.conflicts ?? [])],
      missingEvidence: [...(candidate.missingEvidence ?? [])],
      freshness: candidate.freshness,
      navigationState: candidate.navigationState ?? "available",
      writerState: candidate.writerState ?? "idle",
      blockingConflict: candidate.blockingConflict === true,
    });
  }
  evaluated.sort((a, b) => b.score - a.score || a.nativeThreadId.localeCompare(b.nativeThreadId));
  let result;
  if (sourceIncomplete) result = "incomplete";
  else if (evaluated.length === 0 || evaluated.every((item) => item.score < 0.45)) result = "no_suitable_candidate";
  else {
    const top = evaluated[0];
    const second = evaluated[1];
    const margin = second ? top.score - second.score : 1;
    result = top.score >= 0.65 && margin >= 0.08 && top.dimensions.evidenceCoverage >= 0.6 && !top.blockingConflict
      ? "recommended"
      : "ambiguous";
  }
  const reportBase = { queryId: query.id, graphRevisionId: query.graphRevisionId, result, candidates: evaluated, policyVersion: "selection-policy/1-alpha" };
  const id = contentAddressedId("sel_", "codex-threadgraph/selection-report-id/1", [query.id, fingerprint("selection-candidates/1", evaluated), reportBase.policyVersion]);
  const nextAction = result === "incomplete" ? "inspect_missing_evidence" : result === "recommended" ? "select_thread" : "compare_candidates";
  return immutableClone({ id, ...reportBase, nextAction });
}

const specializationTransitions = {
  suggested: new Set(["confirmed", "rejected", "superseded"]),
  confirmed: new Set(["superseded"]),
  rejected: new Set(),
  superseded: new Set(),
};

export function suggestSpecialization({ threadId, topicId, supportPoints, independenceKeys, evidenceIds, hasDirectEvidence, rejectedEvidenceFingerprint = null }) {
  const evidenceFingerprint = fingerprint("specialization-evidence/1", [...evidenceIds].sort());
  if (supportPoints < 5 || new Set(independenceKeys).size < 2 || hasDirectEvidence !== true || rejectedEvidenceFingerprint === evidenceFingerprint) return null;
  const id = contentAddressedId("clm_", "codex-threadgraph/specialization-id/1", [threadId, topicId, evidenceFingerprint, "suggested"]);
  return immutableClone({ id, threadId, topicId, lifecycle: "suggested", evidenceIds: [...evidenceIds].sort(), evidenceFingerprint, supportPoints });
}

export function reviseSpecialization(current, lifecycle, origin) {
  if (!specializationTransitions[current?.lifecycle]?.has(lifecycle)) fail("SPECIALIZATION_TRANSITION_INVALID", "Illegal specialization transition");
  if (lifecycle === "confirmed" && (!origin || origin.explicitUserAction !== true)) fail("SPECIALIZATION_ACCEPTANCE_REQUIRED", "Confirmation requires explicit user acceptance");
  const id = contentAddressedId("clm_", "codex-threadgraph/specialization-revision-id/1", [current.id, lifecycle, fingerprint("specialization-origin/1", origin ?? null)]);
  return immutableClone({ ...structuredClone(current), id, previousRevisionId: current.id, lifecycle, origin: origin ?? null });
}
