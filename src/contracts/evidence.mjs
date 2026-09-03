export function validateEvidence(input) {
  if (input?.evidenceClass === "observed") {
    if (input.confidenceBand != null || input.numericConfidence != null) {
      return { decision: "reject", code: "EXACT_CONFIDENCE_FORBIDDEN", nextAction: "remove_confidence" };
    }
    return { decision: "allow", evidenceClass: "observed", confidenceBand: null };
  }

  if (input?.evidenceClass === "extracted") {
    if (!input.sourceRange || typeof input.sourceRange !== "object") {
      return { decision: "reject", code: "EVIDENCE_RANGE_REQUIRED", nextAction: "retain_unresolved" };
    }
    if (input.confidenceBand != null || input.numericConfidence != null) {
      return { decision: "reject", code: "EXACT_CONFIDENCE_FORBIDDEN", nextAction: "remove_confidence" };
    }
    return { decision: "allow", evidenceClass: "extracted", confidenceBand: null };
  }

  if (input?.evidenceClass === "inferred") {
    if (input.displayClass === "observed") {
      return { decision: "reject", code: "EVIDENCE_CLASS_ESCALATION", nextAction: "publish_as_inferred" };
    }
    if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) {
      return { decision: "reject", code: "EVIDENCE_CLOSURE_REQUIRED", nextAction: "retain_candidate" };
    }
    return { decision: "allow", evidenceClass: "inferred", confidenceBand: input.confidenceBand ?? "low" };
  }

  return { decision: "reject", code: "EVIDENCE_CLASS_INVALID", nextAction: "correct_evidence" };
}
