#!/usr/bin/env node
import readline from "node:readline";
import { mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { GraphRegistry } from "../src/registry.mjs";
import { GraphService, buildGraphViewModel } from "../src/graph-service.mjs";
import { CodexAppServerHost } from "../src/codex-app-server-host.mjs";
import { IndexingPipeline } from "../src/indexing-pipeline.mjs";

const registryPath = process.env.THREADGRAPH_REGISTRY_PATH ?? join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "threadgraph", "graph.db");
mkdirSync(dirname(registryPath), { recursive: true });
const registry = new GraphRegistry(registryPath);
const service = new GraphService({ registry });
const graphResourceUri = "ui://threadgraph/graph.html";
const graphHtml = readFileSync(new URL("../ui/graph.html", import.meta.url), "utf8");
const tools = [
  { name: "threadgraph_get_graph", description: "Read the current published graph for one project scope.", inputSchema: { type: "object", required: ["scopeId"], properties: { scopeId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_inspect_evidence", description: "Read provenance for one evidence item without source mutation.", inputSchema: { type: "object", required: ["scopeId", "evidenceId"], properties: { scopeId: { type: "string" }, evidenceId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_select_thread", description: "Compare already-indexed threads for a goal. This never refreshes or starts a Turn.", inputSchema: { type: "object", required: ["scopeId", "objective", "requirements"], properties: { scopeId: { type: "string" }, objective: { type: "string" }, requirements: { type: "array" }, anchorThreadIds: { type: "array", items: { type: "string" } } }, additionalProperties: false } },
  { name: "threadgraph_prepare_index", description: "Prepare a bounded local indexing session for one explicitly selected project. The stable project ID defines graph identity and the absolute project path defines the read-only App Server scope. Only initial_graph_open or an explicit user refresh is accepted.", inputSchema: { type: "object", required: ["canonicalProjectId", "canonicalProjectPath", "triggerKind", "requestOrigin"], properties: { canonicalProjectId: { type: "string", minLength: 1, description: "Stable host project ID. It is never used as a filesystem path." }, canonicalProjectPath: { type: "string", description: "Absolute local project directory. It is never used as the graph identity." }, hostId: { type: "string" }, triggerKind: { enum: ["initial_graph_open", "explicit_refresh"] }, requestOrigin: { type: "string" }, observationCutoff: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_publish_index", description: "Validate Extraction Envelopes against one prepared session and atomically publish one local Graph Revision. It cannot start or message a Codex thread.", inputSchema: { type: "object", required: ["sessionId", "extractions"], properties: { sessionId: { type: "string" }, extractions: { type: "array", items: { type: "object" } } }, additionalProperties: false } },
  { name: "threadgraph_cancel_index", description: "Cancel one prepared local indexing session without publishing partial graph state.", inputSchema: { type: "object", required: ["sessionId"], properties: { sessionId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_get_retention", description: "Inspect derived-data retention counts for one project scope without exposing source text.", inputSchema: { type: "object", required: ["scopeId"], properties: { scopeId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_preview_thread_deletion", description: "Preview the derived records that would be removed for one indexed thread. Native Codex history is never changed.", inputSchema: { type: "object", required: ["scopeId", "threadId"], properties: { scopeId: { type: "string" }, threadId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_delete_thread_index", description: "Delete one thread's derived local graph data after explicit user confirmation using the current preview token. Native Codex history is never changed.", inputSchema: { type: "object", required: ["scopeId", "threadId", "confirmationToken", "explicitUserAction"], properties: { scopeId: { type: "string" }, threadId: { type: "string" }, confirmationToken: { type: "string" }, explicitUserAction: { const: true } }, additionalProperties: false } },
  { name: "threadgraph_render_graph", description: "Render the current graph after threadgraph_get_graph has established the project state. Optional relation and evidence filters affect presentation only.", inputSchema: { type: "object", required: ["scopeId"], properties: { scopeId: { type: "string" }, relationKinds: { type: "array", items: { enum: ["belongs_to", "forked_from", "produced", "validated", "references", "related_to", "continues", "contradicts", "supersedes", "specializes_in"] }, uniqueItems: true }, evidenceClasses: { type: "array", items: { enum: ["observed", "extracted", "inferred"] }, uniqueItems: true } }, additionalProperties: false }, _meta: { ui: { resourceUri: graphResourceUri }, "openai/outputTemplate": graphResourceUri, "openai/toolInvocation/invoking": "Rendering thread graph…", "openai/toolInvocation/invoked": "Thread graph ready." } },
];

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function content(value) { return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value }; }
function validateProjectPath(value) {
  if (typeof value !== "string" || !isAbsolute(value)) throw Object.assign(new Error("canonicalProjectPath must be an absolute local directory"), { code: "PROJECT_PATH_INVALID" });
  try {
    const path = realpathSync(value);
    if (!statSync(path).isDirectory()) throw new Error("not a directory");
    return path;
  } catch {
    throw Object.assign(new Error("canonicalProjectPath is unavailable or is not a directory"), { code: "PROJECT_PATH_UNAVAILABLE" });
  }
}
function pipelineFor(canonicalProjectId, projectPath, hostId = "local") {
  if (typeof canonicalProjectId !== "string" || !canonicalProjectId.trim()) throw Object.assign(new Error("canonicalProjectId must be a stable non-empty host project ID"), { code: "PROJECT_ID_INVALID" });
  const host = new CodexAppServerHost({ codexPath: process.env.CODEX_CLI_PATH ?? "codex", projectPath });
  return { host, pipeline: new IndexingPipeline({ registry, host, hostId, canonicalProjectId, canonicalProjectPath: projectPath, workerId: `mcp-${process.pid}` }) };
}
async function call(name, args) {
  if (name === "threadgraph_get_graph") {
    const graph = service.getGraph(args.scopeId);
    return content(graph.state === "ready" ? { ...graph, view: buildGraphViewModel(graph.revision) } : graph);
  }
  if (name === "threadgraph_inspect_evidence") return content(service.inspectEvidence(args.scopeId, args.evidenceId));
  if (name === "threadgraph_select_thread") return content(service.query(args.scopeId, args));
  if (name === "threadgraph_prepare_index") {
    const { host, pipeline } = pipelineFor(args.canonicalProjectId, validateProjectPath(args.canonicalProjectPath), args.hostId ?? "local");
    try { return content(await pipeline.prepare({ triggerKind: args.triggerKind, requestOrigin: args.requestOrigin, observationCutoff: args.observationCutoff })); }
    finally { await host.close(); }
  }
  if (name === "threadgraph_publish_index") {
    const session = registry.getIndexSession(args.sessionId);
    if (!session) throw Object.assign(new Error("Index session does not exist"), { code: "INDEX_SESSION_NOT_FOUND" });
    const request = session.payload.request;
    const { host, pipeline } = pipelineFor(request.canonicalProjectId, validateProjectPath(request.canonicalProjectPath ?? request.canonicalProjectId), request.hostId);
    try { return content(await pipeline.publish({ sessionId: args.sessionId, extractions: args.extractions })); }
    finally { await host.close(); }
  }
  if (name === "threadgraph_cancel_index") {
    const session = registry.getIndexSession(args.sessionId);
    if (!session) throw Object.assign(new Error("Index session does not exist"), { code: "INDEX_SESSION_NOT_FOUND" });
    const request = session.payload.request;
    const { pipeline } = pipelineFor(request.canonicalProjectId, validateProjectPath(request.canonicalProjectPath ?? request.canonicalProjectId), request.hostId);
    return content(pipeline.cancel(args.sessionId));
  }
  if (name === "threadgraph_get_retention") return content(service.getRetention(args.scopeId));
  if (name === "threadgraph_preview_thread_deletion") return content(service.previewThreadDeletion(args.scopeId, args.threadId));
  if (name === "threadgraph_delete_thread_index") return content(service.deleteIndexedThread(args.scopeId, args.threadId, { explicitUserAction: args.explicitUserAction, confirmationToken: args.confirmationToken }));
  if (name === "threadgraph_render_graph") {
    const graph = service.getGraph(args.scopeId);
    const view = buildGraphViewModel(graph.state === "ready" ? graph.revision : null, { relationKinds: args.relationKinds, evidenceClasses: args.evidenceClasses });
    return content({ scopeId: args.scopeId, graphState: graph.state, revisionId: graph.state === "ready" ? graph.revision.id : null, view, retention: service.getRetention(args.scopeId) });
  }
  throw Object.assign(new Error("Unknown tool"), { code: "METHOD_NOT_FOUND" });
}

const lines = readline.createInterface({ input: process.stdin });
lines.on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.method === "initialize") return send({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: {} }, serverInfo: { name: "codex-threadgraph", version: "0.1.0" } } });
  if (request.method === "notifications/initialized") return;
  if (request.method === "tools/list") return send({ jsonrpc: "2.0", id: request.id, result: { tools } });
  if (request.method === "resources/list") return send({ jsonrpc: "2.0", id: request.id, result: { resources: [{ uri: graphResourceUri, name: "Codex ThreadGraph", description: "Interactive evidence-backed thread graph", mimeType: "text/html;profile=mcp-app", _meta: { ui: { prefersBorder: true } } }] } });
  if (request.method === "resources/read") {
    if (request.params?.uri !== graphResourceUri) return send({ jsonrpc: "2.0", id: request.id, error: { code: -32002, message: "Resource not found" } });
    return send({ jsonrpc: "2.0", id: request.id, result: { contents: [{ uri: graphResourceUri, mimeType: "text/html;profile=mcp-app", text: graphHtml, _meta: { ui: { prefersBorder: true } } }] } });
  }
  if (request.method === "tools/call") {
    try { return send({ jsonrpc: "2.0", id: request.id, result: await call(request.params.name, request.params.arguments ?? {}) }); }
    catch (error) { return send({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error.message, data: { code: error.code } } }); }
  }
  if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } });
});
process.on("exit", () => registry?.close());
