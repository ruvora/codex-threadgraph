import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readline from "node:readline";
import test from "node:test";
import { GraphService, buildGraphViewModel } from "../../src/graph-service.mjs";

const scopeId = "scope";
const revision = { id: "grv", observationCutoff: "2026-09-04T00:00:00.000Z", nodes: [{ id: "t", kind: "thread", nativeThreadId: "native-t", canonicalSubjectKey: "thread", lifecycle: "current" }], relations: [{ relationKey: "r", sourceId: "t", targetId: "t", kind: "related_to", evidenceClass: "inferred", confidenceBand: "medium" }], evidenceItems: [{ id: "e", observationId: "o" }], observations: [{ id: "o" }], threadProfiles: [] };
function registry(value = revision) { return { currentRevision: () => value }; }

test("G7 exposes distinct non-color relation semantics", () => {
  const view = buildGraphViewModel(revision);
  assert.equal(view.edges[0].visual, "dashed");
  assert.match(view.edges[0].accessibleLabel, /inferred, medium confidence/);
});

test("G7 distinguishes empty states", () => {
  assert.equal(buildGraphViewModel(null).state, "no_index");
  assert.equal(buildGraphViewModel({ ...revision, nodes: [], relations: [] }).state, "no_threads");
  assert.equal(buildGraphViewModel({ ...revision, relations: [] }).state, "no_relationships");
});

test("G7 query and inspection read only the current revision", () => {
  let reads = 0;
  const service = new GraphService({ registry: { currentRevision: () => { reads += 1; return revision; } } });
  assert.equal(service.inspectEvidence(scopeId, "e").sourceText, null);
  assert.equal(service.query(scopeId, { objective: "x", requirements: [] }).result, "incomplete");
  assert.equal(reads, 2);
});

test("G7 navigation requires explicit action and sends no prompt", async () => {
  const calls = [];
  const service = new GraphService({ registry: registry(), navigator: { navigateToThread: async (value) => { calls.push(value); } } });
  await assert.rejects(service.navigate(scopeId, "t"), { code: "NAVIGATION_AUTHORIZATION_REQUIRED" });
  const result = await service.navigate(scopeId, "t", { explicitUserAction: true });
  assert.deepEqual(calls, [{ threadId: "native-t" }]);
  assert.equal(result.promptSent, false);
});

test("G7 MCP server advertises only read-only graph tools", async () => {
  const registryPath = join(mkdtempSync(join(tmpdir(), "threadgraph-mcp-")), "graph.db");
  const child = spawn(process.execPath, ["server/threadgraph-mcp.mjs"], { cwd: process.cwd(), env: { ...process.env, THREADGRAPH_REGISTRY_PATH: registryPath }, stdio: ["pipe", "pipe", "inherit"] });
  const lines = readline.createInterface({ input: child.stdout });
  const responses = [];
  lines.on("line", (line) => responses.push(JSON.parse(line)));
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`);
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("MCP smoke test timed out")), 2000);
    const poll = setInterval(() => {
      if (responses.length >= 2) { clearInterval(poll); clearTimeout(deadline); resolve(); }
    }, 10);
  });
  child.kill("SIGTERM");
  const names = responses.find((item) => item.id === 2).result.tools.map((item) => item.name);
  assert.deepEqual(names, ["threadgraph_get_graph", "threadgraph_inspect_evidence", "threadgraph_select_thread"]);
  assert.equal(names.some((name) => /start|resume|send|execute/.test(name)), false);
});
