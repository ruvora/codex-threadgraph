import { buildGoalQuery, buildSelectionReport } from "./selection.mjs";
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
    return buildSelectionReport(query, graph.revision.threadProfiles ?? []);
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
