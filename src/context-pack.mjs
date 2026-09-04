import { contentAddressedId, fingerprint } from "./domain/hashing.mjs";
import { immutableClone } from "./domain/immutable.mjs";

const schemaVersion = "threadgraph-context-pack/1-alpha";
const forbiddenKeys = new Set(["permissions", "sandboxPolicy", "sideEffectAuthorization", "claimToken", "lease", "startInstructions", "prompt"]);

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function walk(value) {
  if (Array.isArray(value)) return value.forEach(walk);
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) fail("CONTEXT_PACK_AUTHORITY_FORBIDDEN", `Context Pack cannot contain ${key}`);
    walk(nested);
  }
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
  if (!input.scopeId || !input.graphRevisionId || !input.purpose || !input.generatedAt) fail("CONTEXT_PACK_INVALID", "Required Context Pack fields are missing");
  walk(input);
  const preimage = packPreimage(input);
  const contentDigest = fingerprint("threadgraph-context-pack-content/1", preimage);
  const packId = contentAddressedId("ctx_", "codex-threadgraph/context-pack-id/1", [input.graphRevisionId, fingerprint("context-pack-selection/1", { claims: preimage.selectedClaimIds, evidence: preimage.selectedEvidenceIds }), "context-pack/1-alpha"]);
  const pack = immutableClone({ packId, ...preimage, contentDigest });
  return registry ? registry.recordExport(pack, input.generatedAt) : pack;
}

export function validateContextPack(pack, { scopeId, supportedVersions = [schemaVersion], currentTime, maxAgeMs = 30 * 24 * 60 * 60 * 1000, allowConflicts = false } = {}) {
  walk(pack);
  if (!supportedVersions.includes(pack?.schemaVersion)) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_VERSION_UNSUPPORTED" });
  if (pack.scopeId !== scopeId) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_SCOPE_MISMATCH" });
  const expectedDigest = fingerprint("threadgraph-context-pack-content/1", packPreimage(pack));
  if (expectedDigest !== pack.contentDigest) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_DIGEST_MISMATCH" });
  if (contentId(pack) !== pack.packId) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_ID_MISMATCH" });
  if (currentTime && Date.parse(currentTime) - Date.parse(pack.observationCutoff) > maxAgeMs) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_STALE" });
  if (!allowConflicts && pack.unresolvedConflicts.length > 0) return immutableClone({ decision: "reject", code: "CONTEXT_PACK_CONFLICTED" });
  return immutableClone({ decision: "allow", provenanceOnly: true, executionAuthority: false, packId: pack.packId });
}

function contentId(pack) {
  return contentAddressedId("ctx_", "codex-threadgraph/context-pack-id/1", [pack.graphRevisionId, fingerprint("context-pack-selection/1", { claims: [...pack.selectedClaimIds].sort(), evidence: [...pack.selectedEvidenceIds].sort() }), "context-pack/1-alpha"]);
}
