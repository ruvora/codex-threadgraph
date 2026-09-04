export { DomainValidationError } from "./domain/errors.mjs";
export { validateExtractionEnvelope, validateSourceEnvelope } from "./domain/envelopes.mjs";
export { fingerprint } from "./domain/hashing.mjs";
export { buildGraphRevision } from "./domain/graph-revision.mjs";
export { assertTypedId, isTypedId } from "./domain/ids.mjs";
export { deriveEvidenceId, deriveObservationId } from "./domain/records.mjs";
export { invalidateRelationsByEvidence, reviseRelation } from "./domain/relation-lifecycle.mjs";
