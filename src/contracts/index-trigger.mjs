const allowedOriginalTriggers = new Set(["initial_graph_open", "explicit_refresh"]);

function deny(code, nextAction = null) {
  return { decision: "deny", code, nextAction };
}

export function authorizeIndexUpdate(input) {
  if (input?.trigger === "initial_graph_open") {
    if (input.projectId !== input.selectedProjectId) {
      return deny("PROJECT_NOT_SELECTED", "select_project_graph");
    }
    if (input.hasPublishedRevision) {
      return deny("REVISION_ALREADY_EXISTS", "read_current_revision");
    }
    return { decision: "allow", mode: "initial", nextAction: null };
  }

  if (input?.trigger === "explicit_refresh") {
    if (input.projectId !== input.selectedProjectId) {
      return deny("PROJECT_NOT_SELECTED", "select_project_graph");
    }
    if (input.userInitiated !== true) return deny("TRIGGER_NOT_AUTHORIZED");
    return { decision: "allow", mode: "refresh", nextAction: null };
  }

  if (input?.trigger === "recovery") {
    if (
      allowedOriginalTriggers.has(input.originalTrigger)
      && typeof input.originalRequestId === "string"
      && input.originalRequestId.length > 0
      && input.leaseProjectId === input.projectId
    ) {
      return {
        decision: "allow",
        mode: "continuation",
        originalRequestId: input.originalRequestId,
        nextAction: null,
      };
    }
    return deny("ORIGINAL_TRIGGER_REQUIRED");
  }

  if (input?.trigger === "restart") return deny("ORIGINAL_TRIGGER_REQUIRED");
  if (input?.trigger === "goal_query") {
    if (input.hasPublishedRevision !== true) {
      return deny("TRIGGER_NOT_AUTHORIZED", "open_project_graph");
    }
    if (input.revisionStale === true) {
      return deny("TRIGGER_NOT_AUTHORIZED", "refresh_project_graph");
    }
    return deny("TRIGGER_NOT_AUTHORIZED");
  }
  if (input?.trigger === "ttl_expiry") return deny("TRIGGER_NOT_AUTHORIZED", "offer_explicit_refresh");
  return deny("TRIGGER_NOT_AUTHORIZED");
}
