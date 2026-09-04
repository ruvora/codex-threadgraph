import { canonicalize, contentAddressedId } from "./hashing.mjs";

export function deriveObservationId(observation) {
  return contentAddressedId("obs_", "codex-threadgraph/observation-id/1", [
    observation.threadId,
    canonicalize(observation.sourceRange),
    observation.contentDigest,
    observation.redactionVersion,
  ]);
}

export function deriveEvidenceId(evidence) {
  return contentAddressedId("evd_", "codex-threadgraph/evidence-item-id/1", [
    evidence.observationId,
    canonicalize(evidence.itemLocator),
    evidence.contentDigest,
  ]);
}
