const confidencePolicyVersion = "confidence-policy/1-alpha";
const relationStrengthPolicyVersion = "relation-strength/1-alpha";
const selectionPolicyVersion = "selection-policy/1-alpha";

function isUnitInterval(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function roundSix(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function deriveFreshness(input) {
  if (typeof input?.ageDays !== "number" || !Number.isFinite(input.ageDays) || input.ageDays < 0) {
    return { decision: "reject", code: "AGE_DAYS_INVALID" };
  }
  const halfLife = input.kind === "activity" ? 30 : input.kind === "evidence" ? 90 : null;
  if (halfLife === null) return { decision: "reject", code: "FRESHNESS_KIND_INVALID" };
  return { value: 2 ** (-input.ageDays / halfLife), policyVersion: "freshness-policy/1-alpha" };
}

export function deriveConfidenceBand(input) {
  if (
    input?.hasEvidenceClosure !== true
    || input.semanticRuleSatisfied !== true
    || input.hasUnresolvedCounterEvidence === true
  ) {
    return { band: "rejected", orderingValue: null, policyVersion: confidencePolicyVersion };
  }
  if (input.independentDirectRanges >= 2 && input.hasConcreteSubject === true) {
    return { band: "high", orderingValue: 0.85, policyVersion: confidencePolicyVersion };
  }
  if (input.independentDirectRanges >= 1 && input.hasIndependentCorroboration === true) {
    return { band: "medium", orderingValue: 0.65, policyVersion: confidencePolicyVersion };
  }
  if (input.independentDirectRanges >= 1 || input.hostSummaryOnly === true) {
    return { band: "low", orderingValue: 0.4, policyVersion: confidencePolicyVersion };
  }
  return { band: "rejected", orderingValue: null, policyVersion: confidencePolicyVersion };
}

export function deriveRelationStrength(input) {
  const contributions = [
    [input?.exactNativeLineage === true ? 1 : 0, 6],
    [input?.sharedActiveDecisions ?? 0, 3],
    [input?.sharedArtifactIdentities ?? 0, 3],
    [input?.sharedActiveConstraints ?? 0, 2],
    [input?.explicitCrossReferences ?? 0, 2],
    [input?.sharedCanonicalTopics ?? 0, 1],
  ];
  if (contributions.some(([count]) => !Number.isInteger(count) || count < 0)) {
    return { decision: "reject", code: "RELATION_EVIDENCE_COUNT_INVALID" };
  }
  const points = contributions.reduce((total, [count, weight]) => total + count * weight, 0);
  const categories = contributions.filter(([count]) => count > 0).length;
  let strength = "absent";
  if (input.exactNativeLineage === true || (points >= 6 && categories >= 2)) strength = "strong";
  else if (points >= 3) strength = "moderate";
  else if (points >= 1) strength = "weak";
  return { points, categories, strength, policyVersion: relationStrengthPolicyVersion };
}

export function deriveSelectionScore(input) {
  const positive = [
    ["goalRelevance", 0.4],
    ["evidenceCoverage", 0.25],
    ["continuity", 0.15],
    ["activityFreshness", 0.1],
    ["specializationMatch", 0.1],
  ];
  const risk = [["conflictRisk", 0.25], ["missingRisk", 0.15]];
  const invalidPositive = positive.some(([name]) => input?.[name] !== "not_applicable" && !isUnitInterval(input?.[name]));
  const invalidRisk = risk.some(([name]) => !isUnitInterval(input?.[name]));
  if (invalidPositive || invalidRisk) return { decision: "reject", code: "SELECTION_DIMENSION_INVALID" };

  const applicable = positive.filter(([name]) => input[name] !== "not_applicable");
  if (applicable.length === 0) return { decision: "reject", code: "SELECTION_DIMENSION_INVALID" };
  const applicableWeight = applicable.reduce((total, [, weight]) => total + weight, 0);
  const positiveScore = applicable.reduce((total, [name, weight]) => total + input[name] * weight, 0)
    / applicableWeight;
  const riskPenalty = risk.reduce((total, [name, weight]) => total + input[name] * weight, 0);
  const score = roundSix(Math.min(1, Math.max(0, positiveScore - riskPenalty)));
  return { score, rounding: "half_away_from_zero_6dp", policyVersion: selectionPolicyVersion };
}
