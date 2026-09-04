import { createHash } from "node:crypto";

import { fail } from "./errors.mjs";

const base32Alphabet = "abcdefghijklmnopqrstuvwxyz234567";

export function frame(value) {
  const text = String(value);
  const length = Buffer.byteLength(text, "utf8").toString(16).padStart(8, "0");
  return `${length}:${text}`;
}

export function framedHash(namespace, fields) {
  return createHash("sha256").update([namespace, ...fields].map(frame).join(""), "utf8").digest();
}

export function encodeBase32(buffer) {
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

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("FINGERPRINT_VALUE_INVALID", "Fingerprint numbers must be finite");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return `{${Object.keys(value).sort().map((key) => {
      if (value[key] === undefined) fail("FINGERPRINT_VALUE_INVALID", "Undefined values are not canonical");
      return `${JSON.stringify(key)}:${canonicalize(value[key])}`;
    }).join(",")}}`;
  }
  fail("FINGERPRINT_VALUE_INVALID", "Only JSON-compatible values may be fingerprinted");
}

export function fingerprint(namespace, value) {
  const digest = framedHash(namespace, [canonicalize(value)]);
  return `sha256:${digest.toString("hex")}`;
}

export function contentAddressedId(prefix, namespace, fields) {
  return `${prefix}${encodeBase32(framedHash(namespace, fields))}`;
}
