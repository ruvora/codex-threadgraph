#!/usr/bin/env node
import readline from "node:readline";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { GraphRegistry } from "../src/registry.mjs";
import { GraphService, buildGraphViewModel } from "../src/graph-service.mjs";

const registryPath = process.env.THREADGRAPH_REGISTRY_PATH ?? join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "threadgraph", "graph.db");
mkdirSync(dirname(registryPath), { recursive: true });
const registry = new GraphRegistry(registryPath);
const service = new GraphService({ registry });
const tools = [
  { name: "threadgraph_get_graph", description: "Read the current published graph for one project scope.", inputSchema: { type: "object", required: ["scopeId"], properties: { scopeId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_inspect_evidence", description: "Read provenance for one evidence item without source mutation.", inputSchema: { type: "object", required: ["scopeId", "evidenceId"], properties: { scopeId: { type: "string" }, evidenceId: { type: "string" } }, additionalProperties: false } },
  { name: "threadgraph_select_thread", description: "Compare already-indexed threads for a goal. This never refreshes or starts a Turn.", inputSchema: { type: "object", required: ["scopeId", "objective", "requirements"], properties: { scopeId: { type: "string" }, objective: { type: "string" }, requirements: { type: "array" }, anchorThreadIds: { type: "array", items: { type: "string" } } }, additionalProperties: false } },
];

function send(message) { process.stdout.write(`${JSON.stringify(message)}\n`); }
function content(value) { return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value }; }
async function call(name, args) {
  if (name === "threadgraph_get_graph") {
    const graph = service.getGraph(args.scopeId);
    return content(graph.state === "ready" ? { ...graph, view: buildGraphViewModel(graph.revision) } : graph);
  }
  if (name === "threadgraph_inspect_evidence") return content(service.inspectEvidence(args.scopeId, args.evidenceId));
  if (name === "threadgraph_select_thread") return content(service.query(args.scopeId, args));
  throw Object.assign(new Error("Unknown tool"), { code: "METHOD_NOT_FOUND" });
}

const lines = readline.createInterface({ input: process.stdin });
lines.on("line", async (line) => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.method === "initialize") return send({ jsonrpc: "2.0", id: request.id, result: { protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "codex-threadgraph", version: "0.1.0" } } });
  if (request.method === "notifications/initialized") return;
  if (request.method === "tools/list") return send({ jsonrpc: "2.0", id: request.id, result: { tools } });
  if (request.method === "tools/call") {
    try { return send({ jsonrpc: "2.0", id: request.id, result: await call(request.params.name, request.params.arguments ?? {}) }); }
    catch (error) { return send({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message: error.message, data: { code: error.code } } }); }
  }
  if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, error: { code: -32601, message: "Method not found" } });
});
process.on("exit", () => registry?.close());
