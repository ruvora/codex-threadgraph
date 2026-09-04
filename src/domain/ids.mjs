import { fail } from "./errors.mjs";

const hashPattern = "[a-z2-7]{52}";
const patterns = {
  project: new RegExp(`^prj_${hashPattern}$`),
  thread: new RegExp(`^thr_${hashPattern}$`),
  observation: new RegExp(`^obs_${hashPattern}$`),
  evidence: new RegExp(`^evd_${hashPattern}$`),
  claim: new RegExp(`^clm_${hashPattern}$`),
  nodeRevision: new RegExp(`^nrv_${hashPattern}$`),
  relation: new RegExp(`^rel_${hashPattern}$`),
  relationRevision: new RegExp(`^rlv_${hashPattern}$`),
  graphRevision: new RegExp(`^grv_${hashPattern}$`),
  indexSession: new RegExp(`^idx_${hashPattern}$`),
  query: new RegExp(`^qry_${hashPattern}$`),
  selection: new RegExp(`^sel_${hashPattern}$`),
  export: new RegExp(`^ctx_${hashPattern}$`),
  entity: /^ent_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
};

export function isTypedId(value, kind) {
  if (typeof value !== "string") return false;
  if (kind) return patterns[kind]?.test(value) ?? false;
  return Object.values(patterns).some((pattern) => pattern.test(value));
}

export function assertTypedId(value, kind) {
  if (!isTypedId(value, kind)) fail("ID_INVALID", `Expected ${kind ?? "known"} ID`, { value, kind });
  return value;
}
