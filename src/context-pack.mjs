import { contentAddressedId, fingerprint } from "./domain/hashing.mjs";
import { immutableClone } from "./domain/immutable.mjs";

const schemaVersion = "threadgraph-context-pack/1-alpha";
const forbiddenKeys = new Set(["permissions", "sandboxPolicy", "sideEffectAuthorization", "claimToken", "lease", "startInstructions", "prompt"]);
const packKeys = new Set(["packId", "schemaVersion", "buildIdentity", "scopeId", "graphRevisionId", "selectedClaimIds", "selectedEvidenceIds", "purpose", "derivedContent", "unresolvedConflicts", "missingSources", "observationCutoff", "generatedAt", "contentDigest"]);

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function walk(value) {
  if (Array.isArray(value)) return value.forEach(walk);
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) fail("CONTEXT_PACK_AUTHORITY_FORBIDDEN", `Context Pack cannot contain ${key}`);
    walk(nested);
  }
}

function validString(value, maxLength = 500) { return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= maxLength; }
function validStringList(value, maxItems = 500) { return Array.isArray(value) && value.length <= maxItems && value.every((entry) => validString(entry)); }
function canonicalTime(value) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}
function shapeCode(value, { requireEnvelope = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "CONTEXT_PACK_INVALID";
  if (requireEnvelope && Object.keys(value).some((key) => !packKeys.has(key))) return "CONTEXT_PACK_FIELD_UNSUPPORTED";
  if (!validString(value.buildIdentity) || !/^codex-threadgraph\/[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(value.buildIdentity)
    || !validString(value.scopeId) || !validString(value.graphRevisionId) || !validString(value.purpose, 1_000)
    || !validStringList(value.selectedClaimIds) || !validStringList(value.selectedEvidenceIds)
    || !validStringList(value.unresolvedConflicts, 100) || !validStringList(value.missingSources, 100)
    || !value.derivedContent || typeof value.derivedContent !== "object" || Array.isArray(value.derivedContent)
    || Object.keys(value.derivedContent).some((key) => key !== "summary") || !validString(value.derivedContent.summary, 6_000)) return "CONTEXT_PACK_INVALID";
  const cutoff = canonicalTime(value.observationCutoff);
  const generated = canonicalTime(value.generatedAt);
  if (cutoff === null || generated === null || cutoff > generated) return "CONTEXT_PACK_TIME_INVALID";
  if (requireEnvelope && (!validString(value.packId, 256) || !validString(value.contentDigest, 128))) return "CONTEXT_PACK_INVALID";
  return null;
}

function packPreimage(input) {
  return {
    schemaVersion,
    buildIdentity: input.buildIdentity,
    scopeId: input.scopeId,
    graphRevisionId: input.graphRevisionId,
    selectedClaimIds: [...new Set(input.selectedClaimIds ?? [])].sort(),
    selectedEvidenceIds: [...new Set(input.selectedEvidenceIds ?? [])].sort(),
    purpose: input.purpose,
    derivedContent: input.derivedContent,
    unresolvedConflicts: [...(input.unresolvedConflicts ?? [])],
    missingSources: [...(input.missingSources ?? [])],
    observationCutoff: input.observationCutoff,
    generatedAt: input.generatedAt,
  };
}

export function createContextPack(input, registry) {
  if (input.explicitSelection !== true) fail("CONTEXT_PACK_SELECTION_REQUIRED", "Export requires explicit user selection");
  walk(input);
  const preimage = packPreimage(input);
  const invalid = shapeCode(preimage);
  if (invalid) fail(invalid, "Context Pack fields do not satisfy the public schema");
  const contentDigest = fingerprint("threadgraph-context-pack-content/1", preimage);
  const packId = contentAddressedId("ctx_", "codex-threadgraph/context-pack-id/1", [input.graphRevisionId, fingerprint("context-pack-selection/1", { claims: preimage.selectedClaimIds, evidence: preimage.selectedEvidenceIds, purpose: preimage.purpose }), contentDigest, "context-pack/1-alpha"]);
  const pack = immutableClone({ packId, ...preimage, contentDigest });
  return registry ? registry.recordExport(pack, input.generatedAt) : pack;
}

export function validateContextPack(pack, { scopeId, supportedVersions = [schemaVersion], trustedBuildIdentities = null, currentTime, maxAgeMs = 30 * 24 * 60 * 60 * 1000, maxFutureSkewMs = 5 * 60 * 1000, allowConflicts = false, allowMissingSources = false } = {}) {
  try { walk(pack); } catch (error) { return immutableClone({ decision: "reject", code: error.code }); }
  if (!supportedVersions.includes(pack?.schemaVersion)) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_VERSION_UNSUPPORTED" });
  const invalid = shapeCode(pack, { requireEnvelope: true });
  if (invalid) return immutableClone({ decision: "reject", code: invalid });
  if (pack.scopeId !== scopeId) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_SCOPE_MISMATCH" });
  if (trustedBuildIdentities && !trustedBuildIdentities.includes(pack.buildIdentity)) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_SOURCE_UNTRUSTED" });
  const expectedDigest = fingerprint("threadgraph-context-pack-content/1", packPreimage(pack));
  if (expectedDigest !== pack.contentDigest) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_DIGEST_MISMATCH" });
  if (contentId(pack) !== pack.packId) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_ID_MISMATCH" });
  const now = currentTime ? canonicalTime(currentTime) : Date.now();
  if (now === null || Date.parse(pack.generatedAt) > now + maxFutureSkewMs) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_TIME_INVALID" });
  if (now - Date.parse(pack.observationCutoff) > maxAgeMs) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_STALE" });
  if (!allowConflicts && pack.unresolvedConflicts.length > 0) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_CONFLICTED" });
  if (!allowMissingSources && pack.missingSources.length > 0) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_SOURCE_MISSING" });
  return immutableClone({ decision: pack.missingSources.length ? "partial" : "allow", provenanceOnly: true, executionAuthority: false, packId: pack.packId });
}

function contentId(pack) {
  return contentAddressedId("ctx_", "codex-threadgraph/context-pack-id/1", [pack.graphRevisionId, fingerprint("context-pack-selection/1", { claims: [...pack.selectedClaimIds].sort(), evidence: [...pack.selectedEvidenceIds].sort(), purpose: pack.purpose }), pack.contentDigest, "context-pack/1-alpha"]);
}
