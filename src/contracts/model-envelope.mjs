function containsNumericField(value, fieldNames) {
  if (Array.isArray(value)) return value.some((item) => containsNumericField(item, fieldNames));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, item]) => (
    (fieldNames.has(key) && typeof item === "number")
    || containsNumericField(item, fieldNames)
  ));
}

export function validateModelEnvelope(input) {
  if (containsNumericField(input, new Set(["numericConfidence", "confidence", "orderingValue"]))) {
    return {
      decision: "reject",
      code: "MODEL_NUMERIC_CONFIDENCE_FORBIDDEN",
      nextAction: "derive_confidence_from_evidence",
    };
  }
  if (containsNumericField(input, new Set(["selectionScore", "score"]))) {
    return {
      decision: "reject",
      code: "MODEL_SELECTION_SCORE_FORBIDDEN",
      nextAction: "derive_selection_deterministically",
    };
  }
  if (Array.isArray(input?.grantedActions) && input.grantedActions.length > 0) {
    return { decision: "reject", code: "MODEL_AUTHORITY_FORBIDDEN", nextAction: null };
  }
  return { decision: "allow", numericFieldsAccepted: false, authorityGranted: false };
}
