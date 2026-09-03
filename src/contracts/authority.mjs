const executionActions = new Set(["start_thread", "resume_thread"]);

export function authorizeRecommendationAction(input) {
  if (executionActions.has(input?.action)) {
    return { decision: "deny", code: "EXECUTION_AUTHORITY_FORBIDDEN", nextAction: null };
  }
  if (input?.action === "send_prompt" || input?.sendsPrompt === true) {
    return { decision: "deny", code: "PROMPT_SUBMISSION_FORBIDDEN", nextAction: null };
  }
  if (input?.action !== "navigate") {
    return { decision: "deny", code: "ACTION_UNSUPPORTED", nextAction: null };
  }
  if (input.explicitUserAction !== true) {
    return { decision: "deny", code: "EXPLICIT_SELECTION_REQUIRED", nextAction: "await_user_selection" };
  }
  if (input.nativeThreadIdKnown !== true || input.hostConnected !== true) {
    return { decision: "deny", code: "NAVIGATION_TARGET_UNAVAILABLE", nextAction: "inspect_target_status" };
  }
  return { decision: "allow", action: "navigate", nextAction: "open_native_thread" };
}
