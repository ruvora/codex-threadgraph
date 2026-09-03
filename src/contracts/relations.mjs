function reject(code) {
  return { decision: "reject", code, lifecycle: "candidate" };
}

export function validateRelation(input) {
  if (input?.kind === "contradicts") {
    const directEvidenceClasses = new Set(["observed", "extracted"]);
    const valid = input.sameCanonicalSubject === true
      && input.incompatiblePredicateOrPolarity === true
      && input.overlappingValidity === true
      && directEvidenceClasses.has(input.leftEvidenceClass)
      && directEvidenceClasses.has(input.rightEvidenceClass);
    return valid
      ? { decision: "allow", kind: "contradicts", lifecycle: "current" }
      : reject("CONTRADICTION_SEMANTICS_MISSING");
  }

  if (input?.kind === "supersedes") {
    const valid = input.explicitReplacementEvidence === true || input.acceptedUserResolution === true;
    return valid
      ? { decision: "allow", kind: "supersedes", lifecycle: "current" }
      : reject("SUPERSESSION_AUTHORITY_MISSING");
  }

  if (input?.kind === "continues") {
    const valid = input.isLater === true
      && input.subjectContinuity === true
      && (input.exactLineage === true || input.explicitReference === true);
    return valid
      ? { decision: "allow", kind: "continues", lifecycle: "current" }
      : reject("CONTINUATION_LINK_MISSING");
  }

  return reject("RELATION_KIND_UNSUPPORTED");
}
