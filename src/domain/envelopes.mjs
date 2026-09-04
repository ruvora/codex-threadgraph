import { validateModelEnvelope } from "../contracts/model-envelope.mjs";
import { fail } from "./errors.mjs";
import { immutableClone } from "./immutable.mjs";
import { assertTypedId } from "./ids.mjs";

const digestPattern = /^sha256:[0-9a-f]{64}$/;
const coverageValues = new Set(["metadata_only", "summary_indexed", "turn_indexed", "partial", "unreadable"]);
const claimKinds = new Set(["topic", "decision", "constraint", "artifact", "result"]);
const modalities = new Set(["asserted", "proposed", "questioned", "rejected"]);
const polarities = new Set(["affirm", "deny", "unknown"]);
const sourceKeys = new Set([
  "schemaVersion", "projectId", "threadId", "nativeThreadId", "range", "observedAt",
  "sourceUpdatedAt", "contentDigest", "redactionPolicy", "coverage", "items",
]);
const extractionKeys = new Set([
  "schemaVersion", "sourceEnvelopeDigest", "extractorVersion", "claims", "aliases",
  "relationCandidates", "warnings",
]);
const rangeKeys = new Set(["startTurnId", "endTurnId", "itemIndexes"]);
const claimKeys = new Set([
  "kind", "subjectCandidate", "modality", "polarity", "lifecycle", "evidenceLocators",
  "predicate", "object", "validTime",
]);
const aliasKeys = new Set(["alias", "entityKind", "explicit", "evidenceLocators"]);
const relationCandidateKeys = new Set([
  "sourceCandidate", "targetCandidate", "kind", "explanation", "alternatives", "evidenceLocators",
]);

function requireExactKeys(input, allowed, code) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(code, "Envelope must be an object");
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) fail(code, "Envelope contains unknown fields", { unknown });
}

function requireIsoTimestamp(value, field, code) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail(code, `${field} must be a canonical ISO timestamp`);
  }
}

function requireDigest(value, code) {
  if (!digestPattern.test(value)) fail(code, "Expected a lowercase SHA-256 digest");
}

function validateSourceItem(item) {
  const allowed = new Set(["locator", "role", "type", "text", "terminalStatus", "artifactReference"]);
  requireExactKeys(item, allowed, "SOURCE_ITEM_INVALID");
  if (typeof item.locator !== "string" || item.locator.length === 0) fail("SOURCE_ITEM_INVALID", "Item locator is required");
  if (!["user", "assistant", "system", "tool"].includes(item.role)) fail("SOURCE_ITEM_INVALID", "Item role is invalid");
  if (typeof item.type !== "string" || item.type.length === 0) fail("SOURCE_ITEM_INVALID", "Item type is required");
  if (typeof item.text !== "string") fail("SOURCE_ITEM_INVALID", "Item text must be redacted text");
}

export function validateSourceEnvelope(input, context = {}) {
  requireExactKeys(input, sourceKeys, "SOURCE_SCHEMA_INVALID");
  if (input.schemaVersion !== "source-envelope/1-alpha") fail("SOURCE_SCHEMA_UNSUPPORTED", "Unsupported Source Envelope schema");
  assertTypedId(input.projectId, "project");
  assertTypedId(input.threadId, "thread");
  if (context.projectId && input.projectId !== context.projectId) fail("SOURCE_SCOPE_MISMATCH", "Source project is outside the frozen scope");
  if (typeof input.nativeThreadId !== "string" || input.nativeThreadId.length === 0) fail("SOURCE_SCHEMA_INVALID", "nativeThreadId is required");
  requireExactKeys(input.range, rangeKeys, "SOURCE_SCHEMA_INVALID");
  if (
    typeof input.range.startTurnId !== "string"
    || typeof input.range.endTurnId !== "string"
    || !Array.isArray(input.range.itemIndexes)
    || input.range.itemIndexes.some((index) => !Number.isInteger(index) || index < 0)
    || new Set(input.range.itemIndexes).size !== input.range.itemIndexes.length
  ) fail("SOURCE_SCHEMA_INVALID", "A bounded range is required");
  requireIsoTimestamp(input.observedAt, "observedAt", "SOURCE_SCHEMA_INVALID");
  requireIsoTimestamp(input.sourceUpdatedAt, "sourceUpdatedAt", "SOURCE_SCHEMA_INVALID");
  if (Date.parse(input.sourceUpdatedAt) > Date.parse(input.observedAt)) fail("SOURCE_TIME_INVALID", "Source update cannot follow observation");
  if (context.observationCutoff && Date.parse(input.observedAt) > Date.parse(context.observationCutoff)) fail("SOURCE_CUTOFF_EXCEEDED", "Observation follows the frozen cutoff");
  requireDigest(input.contentDigest, "SOURCE_SCHEMA_INVALID");
  if (typeof input.redactionPolicy !== "string" || input.redactionPolicy.length === 0) fail("SOURCE_SCHEMA_INVALID", "redactionPolicy is required");
  if (input.redactionPolicy !== "redaction/1-alpha") fail("SOURCE_SCHEMA_UNSUPPORTED", "Unsupported redaction policy");
  if (!coverageValues.has(input.coverage)) fail("SOURCE_SCHEMA_INVALID", "coverage is invalid");
  if (!Array.isArray(input.items)) fail("SOURCE_SCHEMA_INVALID", "items must be an array");
  if (input.items.length > (context.maxItems ?? Number.POSITIVE_INFINITY)) fail("SOURCE_BUDGET_EXCEEDED", "Item budget exceeded");
  let textChars = 0;
  const locators = new Set();
  for (const item of input.items) {
    validateSourceItem(item);
    if (locators.has(item.locator)) fail("SOURCE_ITEM_INVALID", "Item locators must be unique");
    locators.add(item.locator);
    textChars += item.text.length;
  }
  if (textChars > (context.maxTextChars ?? Number.POSITIVE_INFINITY)) fail("SOURCE_BUDGET_EXCEEDED", "Text budget exceeded");
  return immutableClone(input);
}

function validateCandidate(candidate, sourceLocators, code) {
  if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.evidenceLocators) || candidate.evidenceLocators.length === 0) {
    fail(code, "Candidate requires evidence locators");
  }
  for (const locator of candidate.evidenceLocators) {
    if (!sourceLocators.has(locator)) fail("EXTRACTION_EVIDENCE_MISSING", "Candidate references a missing source item", { locator });
  }
}

export function validateExtractionEnvelope(input, context = {}) {
  requireExactKeys(input, extractionKeys, "EXTRACTION_SCHEMA_INVALID");
  if (input.schemaVersion !== "extraction/1-alpha") fail("EXTRACTION_SCHEMA_UNSUPPORTED", "Unsupported Extraction Envelope schema");
  requireDigest(input.sourceEnvelopeDigest, "EXTRACTION_SCHEMA_INVALID");
  if (context.sourceEnvelopeDigest && input.sourceEnvelopeDigest !== context.sourceEnvelopeDigest) fail("EXTRACTION_SOURCE_MISMATCH", "Extraction source digest does not match");
  if (typeof input.extractorVersion !== "string" || input.extractorVersion.length === 0) fail("EXTRACTION_SCHEMA_INVALID", "extractorVersion is required");
  if (input.extractorVersion !== "extractor/1-alpha") fail("EXTRACTION_SCHEMA_UNSUPPORTED", "Unsupported extractor version");
  for (const field of ["claims", "aliases", "relationCandidates", "warnings"]) {
    if (!Array.isArray(input[field])) fail("EXTRACTION_SCHEMA_INVALID", `${field} must be an array`);
  }
  const sourceLocators = context.sourceLocators ?? new Set();
  for (const claim of input.claims) {
    requireExactKeys(claim, claimKeys, "EXTRACTION_CLAIM_INVALID");
    validateCandidate(claim, sourceLocators, "EXTRACTION_CLAIM_INVALID");
    if (!claimKinds.has(claim.kind) || typeof claim.subjectCandidate !== "string" || claim.subjectCandidate.length === 0) fail("EXTRACTION_CLAIM_INVALID", "Claim kind and subject are required");
    if (!modalities.has(claim.modality) || !polarities.has(claim.polarity) || typeof claim.lifecycle !== "string") fail("EXTRACTION_CLAIM_INVALID", "Claim semantics are invalid");
  }
  for (const alias of input.aliases) {
    requireExactKeys(alias, aliasKeys, "EXTRACTION_ALIAS_INVALID");
    validateCandidate(alias, sourceLocators, "EXTRACTION_ALIAS_INVALID");
  }
  for (const relation of input.relationCandidates) {
    requireExactKeys(relation, relationCandidateKeys, "EXTRACTION_RELATION_INVALID");
    validateCandidate(relation, sourceLocators, "EXTRACTION_RELATION_INVALID");
  }
  if (!input.warnings.every((warning) => typeof warning === "string")) fail("EXTRACTION_SCHEMA_INVALID", "warnings must contain strings");
  const modelBoundary = validateModelEnvelope(input);
  if (modelBoundary.decision !== "allow") fail("EXTRACTION_NUMERIC_AUTHORITY", modelBoundary.code, { nextAction: modelBoundary.nextAction });
  return immutableClone(input);
}
