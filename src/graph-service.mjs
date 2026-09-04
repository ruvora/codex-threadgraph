import { buildGoalQuery, buildSelectionReport } from "./selection.mjs";
import { deriveFreshness } from "./contracts/derivation.mjs";
import { immutableClone } from "./domain/immutable.mjs";

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

export class GraphService {
  #registry;
  #navigator;
  constructor({ registry, navigator = null }) { this.#registry = registry; this.#navigator = navigator; }

  getGraph(scopeId) {
    const revision = this.#registry.currentRevision(scopeId);
    if (!revision) return immutableClone({ state: "no_index", nextAction: "open_project_graph" });
    return immutableClone({ state: "ready", revision });
  }

  inspectEvidence(scopeId, evidenceId) {
    const graph = this.getGraph(scopeId);
    if (graph.state !== "ready") return graph;
    const evidence = graph.revision.evidenceItems?.find((item) => item.id === evidenceId);
    if (!evidence) fail("EVIDENCE_NOT_FOUND", "Evidence does not exist in the current revision");
    const observation = graph.revision.observations?.find((item) => item.id === evidence.observationId);
    return immutableClone({ evidence, observation, sourceText: null, disclosure: "summary_only" });
  }

  query(scopeId, input) {
    const graph = this.getGraph(scopeId);
    if (graph.state !== "ready") return graph;
    const query = buildGoalQuery({ ...input, scopeId, graphRevisionId: graph.revision.id, observationCutoff: graph.revision.observationCutoff });
    return buildSelectionReport(query, query.result === "incomplete" ? [] : deriveSelectionCandidates(graph.revision, query));
  }

  async navigate(scopeId, threadId, { explicitUserAction = false } = {}) {
    if (explicitUserAction !== true) fail("NAVIGATION_AUTHORIZATION_REQUIRED", "Navigation requires explicit selection");
    const graph = this.getGraph(scopeId);
    if (graph.state !== "ready") return graph;
    const node = graph.revision.nodes.find((item) => item.id === threadId && item.kind === "thread");
    if (!node?.nativeThreadId) fail("NAVIGATION_TARGET_UNAVAILABLE", "Native thread identity is unavailable");
    if (typeof this.#navigator?.navigateToThread !== "function") fail("NAVIGATION_UNSUPPORTED", "Host navigation capability is unavailable");
    const result = await this.#navigator.navigateToThread({ threadId: node.nativeThreadId });
    return immutableClone({ navigated: true, nativeThreadId: node.nativeThreadId, promptSent: false, result: result ?? null });
  }
}

function normalizedSubject(node) {
  return String(node.canonicalSubjectKey ?? "").normalize("NFKC").trim().toLowerCase().replace(/^label:[^:]+:/, "");
}
function weightedMean(values) {
  const denominator = values.reduce((sum, item) => sum + item.weight, 0);
  return denominator === 0 ? 0 : values.reduce((sum, item) => sum + item.value * item.weight, 0) / denominator;
}
function importance(value) { return value === "required" ? 3 : value === "preferred" ? 2 : 1; }

export function deriveSelectionCandidates(revision, query) {
  const nodes = new Map(revision.nodes.map((node) => [node.id, node]));
  const evidence = new Map((revision.evidenceItems ?? []).map((item) => [item.id, item]));
  const observations = new Map((revision.observations ?? []).map((item) => [item.id, item]));
  const anchors = new Set(query.anchorThreadIds ?? []);
  const lineage = revision.relations.filter((edge) => edge.kind === "forked_from");
  return revision.nodes.filter((node) => node.kind === "thread" && node.nativeThreadId).map((thread) => {
    const outgoing = revision.relations.filter((edge) => edge.sourceId === thread.id && ["references", "produced", "validated"].includes(edge.kind));
    const requirementValues = query.requirements.map((requirement) => {
      const matches = outgoing.filter((edge) => normalizedSubject(nodes.get(edge.targetId) ?? {}) === requirement.subject);
      const match = matches.length > 0 ? 1 : 0;
      const depth = matches.some((edge) => edge.evidenceClass === "observed") ? 1 : matches.some((edge) => edge.evidenceClass === "extracted") ? 0.85 : matches.length > 0 ? 0.5 : 0;
      return { requirement, matches, match, depth, weight: importance(requirement.importance) };
    });
    const required = requirementValues.filter((item) => item.requirement.importance === "required");
    const evidenceIds = [...new Set(requirementValues.flatMap((item) => item.matches.flatMap((edge) => edge.evidenceIds ?? [])))].sort();
    const observedTimes = evidenceIds.map((id) => observations.get(evidence.get(id)?.observationId)?.observedAt).filter(Boolean).map(Date.parse);
    const mostRecent = observedTimes.length > 0 ? Math.max(...observedTimes) : Date.parse(revision.observationCutoff);
    const ageDays = Math.max(0, (Date.parse(query.observationCutoff) - mostRecent) / 86_400_000);
    const freshness = deriveFreshness({ kind: "activity", ageDays }).value;
    let continuity = "not_applicable";
    if (anchors.size > 0) {
      const direct = lineage.some((edge) => (edge.sourceId === thread.id && anchors.has(edge.targetId)) || (edge.targetId === thread.id && anchors.has(edge.sourceId)));
      continuity = anchors.has(thread.id) || direct ? 1 : 0;
    }
    const conflict = revision.relations.some((edge) => edge.kind === "contradicts" && (edge.sourceId === thread.id || edge.targetId === thread.id));
    const missingRequired = required.filter((item) => item.match === 0);
    return {
      threadId: thread.id,
      nativeThreadId: thread.nativeThreadId,
      projectId: revision.scopeId,
      dimensions: {
        goalRelevance: weightedMean(requirementValues.map((item) => ({ value: item.match, weight: item.weight }))),
        evidenceCoverage: weightedMean(required.map((item) => ({ value: item.depth, weight: item.weight }))),
        continuity,
        activityFreshness: freshness,
        specializationMatch: requirementValues.some((item) => item.match > 0 && item.matches.some((edge) => nodes.get(edge.targetId)?.kind === "topic")) ? 0.5 : 0,
        conflictRisk: conflict ? 1 : 0,
        missingRisk: required.length === 0 ? 0 : missingRequired.length / required.length,
      },
      evidenceIds,
      conflicts: conflict ? ["unresolved_contradiction"] : [],
      missingEvidence: missingRequired.map((item) => item.requirement.subject),
      freshness: ageDays === 0 ? "current" : "aged",
      blockingConflict: conflict,
      navigationState: "available",
      writerState: "unknown",
    };
  });
}

export function buildGraphViewModel(revision) {
  if (!revision) return immutableClone({ state: "no_index", message: "No graph has been indexed.", nextAction: "open_project_graph", nodes: [], edges: [] });
  const nodes = revision.nodes.map((node) => ({ id: node.id, kind: node.kind, label: node.label ?? node.canonicalSubjectKey, states: [node.lifecycle, ...(node.states ?? [])] }));
  const edges = revision.relations.map((edge) => ({
    id: edge.relationKey,
    source: edge.sourceId,
    target: edge.targetId,
    kind: edge.kind,
    evidenceClass: edge.evidenceClass,
    confidenceBand: edge.evidenceClass === "inferred" ? edge.confidenceBand : null,
    visual: edge.evidenceClass === "observed" ? "solid" : edge.evidenceClass === "extracted" ? "double" : "dashed",
    accessibleLabel: `${edge.kind}, ${edge.evidenceClass}${edge.confidenceBand ? `, ${edge.confidenceBand} confidence` : ""}`,
  }));
  return immutableClone({ state: nodes.length === 0 ? "no_threads" : edges.length === 0 ? "no_relationships" : "ready", observationCutoff: revision.observationCutoff, nodes, edges });
}
