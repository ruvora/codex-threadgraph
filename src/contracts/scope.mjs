function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function validateScope(input) {
  if (
    input?.scopeKind !== "project"
    || typeof input.projectId !== "string"
    || input.projectId.length === 0
    || !Array.isArray(input.authorizedProjectIds)
    || !isPositiveInteger(input.maxThreads)
    || !isPositiveInteger(input.maxSourceChars)
  ) {
    return { decision: "reject", code: "SCOPE_INVALID", nextAction: "correct_scope" };
  }

  if (!input.authorizedProjectIds.includes(input.projectId)) {
    return { decision: "reject", code: "SCOPE_WIDENING", nextAction: "choose_authorized_project" };
  }

  if (input.referencedThread && input.referencedThread.projectId !== input.projectId) {
    return {
      decision: "record_unresolved",
      code: "THREAD_OUT_OF_SCOPE",
      readAuthorized: false,
      nextAction: null,
    };
  }

  return { decision: "allow", scopeKind: "project", projectId: input.projectId };
}
