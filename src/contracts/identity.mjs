import { createHash } from "node:crypto";

const base32Alphabet = "abcdefghijklmnopqrstuvwxyz234567";

function frame(value) {
  const text = String(value);
  const length = Buffer.byteLength(text, "utf8").toString(16).padStart(8, "0");
  return `${length}:${text}`;
}

function framedHash(namespace, fields) {
  return createHash("sha256").update([namespace, ...fields].map(frame).join(""), "utf8").digest();
}

function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += base32Alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

function requireIdentityField(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

export function deriveStableId(input) {
  const hostId = requireIdentityField(input?.hostId, "hostId");
  if (input.kind === "thread") {
    const nativeThreadId = requireIdentityField(input.nativeThreadId, "nativeThreadId");
    const digest = framedHash("codex-threadgraph/thread-id/1", [hostId, nativeThreadId]);
    return { id: `thr_${encodeBase32(digest)}`, policyVersion: "id-policy/1-alpha" };
  }
  if (input.kind === "project") {
    const canonicalProjectId = requireIdentityField(input.canonicalProjectId, "canonicalProjectId");
    const digest = framedHash("codex-threadgraph/project-id/1", [hostId, canonicalProjectId]);
    return { id: `prj_${encodeBase32(digest)}`, policyVersion: "id-policy/1-alpha" };
  }
  throw new TypeError(`Unsupported identity kind: ${input?.kind}`);
}

export function deriveSourceDigest(input) {
  const threadId = requireIdentityField(input?.threadId, "threadId");
  const sourceRange = requireIdentityField(input?.sourceRange, "sourceRange");
  if (typeof input.content !== "string") throw new TypeError("content must be a string");
  const digest = framedHash("codex-threadgraph/source-digest/1", [threadId, sourceRange, input.content]);
  return { digest: `sha256:${digest.toString("hex")}`, policyVersion: "digest-policy/1-alpha" };
}
