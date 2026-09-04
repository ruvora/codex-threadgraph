import assert from "node:assert/strict";
import test from "node:test";
import { createContextPack, validateContextPack } from "../../src/context-pack.mjs";

const input = { explicitSelection: true, buildIdentity: "codex-threadgraph/0.1.0", scopeId: "scope", graphRevisionId: "revision", selectedClaimIds: ["claim"], selectedEvidenceIds: ["evidence"], purpose: "continue storage design", derivedContent: { summary: "SQLite was selected." }, unresolvedConflicts: [], missingSources: [], observationCutoff: "2026-09-04T00:00:00.000Z", generatedAt: "2026-09-04T01:00:00.000Z" };

test("G8 creates deterministic provenance-only Context Packs", () => {
  const first = createContextPack(input);
  const second = createContextPack(input);
  assert.deepEqual(first, second);
  assert.match(first.packId, /^ctx_/);
  assert.equal(validateContextPack(first, { scopeId: "scope", currentTime: "2026-09-05T00:00:00.000Z" }).executionAuthority, false);
  assert.notEqual(createContextPack({ ...input, purpose: "different purpose" }).packId, first.packId);
  assert.notEqual(createContextPack({ ...input, derivedContent: { summary: "PostgreSQL was selected." } }).packId, first.packId);
});

test("G8 requires explicit selection and forbids execution authority", () => {
  assert.throws(() => createContextPack({ ...input, explicitSelection: false }), { code: "CONTEXT_PACK_SELECTION_REQUIRED" });
  assert.throws(() => createContextPack({ ...input, derivedContent: { permissions: ["write"] } }), { code: "CONTEXT_PACK_AUTHORITY_FORBIDDEN" });
  assert.throws(() => createContextPack({ ...input, buildIdentity: "unknown/1" }), { code: "CONTEXT_PACK_INVALID" });
  const forgedAuthority = { ...createContextPack(input), derivedContent: { permissions: ["write"] } };
  assert.equal(validateContextPack(forgedAuthority, { scopeId: "scope" }).code, "CONTEXT_PACK_AUTHORITY_FORBIDDEN");
});

test("G8 rejects forged, unsupported, stale, scoped, and conflicted packs", () => {
  const pack = createContextPack(input);
  assert.equal(validateContextPack({ ...pack, purpose: "forged" }, { scopeId: "scope" }).code, "CONTEXT_PACK_DIGEST_MISMATCH");
  assert.equal(validateContextPack({ ...pack, schemaVersion: "future" }, { scopeId: "scope" }).code, "CONTEXT_PACK_VERSION_UNSUPPORTED");
  assert.equal(validateContextPack(pack, { scopeId: "other" }).code, "CONTEXT_PACK_SCOPE_MISMATCH");
  assert.equal(validateContextPack(pack, { scopeId: "scope", currentTime: "2027-09-04T00:00:00.000Z" }).code, "CONTEXT_PACK_STALE");
  const conflicted = createContextPack({ ...input, unresolvedConflicts: ["decision conflict"] });
  assert.equal(validateContextPack(conflicted, { scopeId: "scope" }).code, "CONTEXT_PACK_CONFLICTED");
  const missing = createContextPack({ ...input, missingSources: ["evidence unavailable"] });
  assert.equal(validateContextPack(missing, { scopeId: "scope" }).code, "CONTEXT_PACK_SOURCE_MISSING");
  assert.equal(validateContextPack(missing, { scopeId: "scope", allowMissingSources: true }).decision, "partial");
});

test("G8 records an export before returning and reuses an identical record", () => {
  const calls = [];
  const registry = { recordExport(pack) { calls.push(pack); return pack; } };
  const first = createContextPack(input, registry);
  const second = createContextPack(input, registry);
  assert.equal(calls.length, 2);
  assert.equal(first.packId, second.packId);
  assert.equal(calls[0].contentDigest, first.contentDigest);
});
