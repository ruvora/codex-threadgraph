import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CodexAppServerHost } from "../../src/codex-app-server-host.mjs";
import { IndexRequestCoordinator, ScopedSourceAdapter } from "../../src/source-adapter.mjs";

const hostId = "host-local";
const canonicalProjectId = "/repo/a";

function hostFixture() {
  const calls = [];
  let scopeId;
  return {
    calls,
    setScope(value) { scopeId = value; },
    async listThreads({ projectId }) {
      scopeId = projectId;
      calls.push(["list", projectId]);
      return [{ id: "native-1", projectId, title: "one", updatedAt: "2026-09-03T00:00:00.000Z" }];
    },
    async readThread({ threadId }) {
      calls.push(["read", threadId]);
      return {
        id: threadId,
        projectId: scopeId,
        updatedAt: "2026-09-03T00:00:00.000Z",
        statusBefore: "notLoaded",
        statusAfter: "notLoaded",
        turns: [{ id: "turn-1", status: "completed", items: [{ role: "user", type: "message", text: "token sk_secretsecretsecret user@example.com" }] }],
      };
    },
  };
}

test("G2 rejects an out-of-scope read before calling the host", async () => {
  const host = hostFixture();
  const adapter = new ScopedSourceAdapter({ host, hostId, canonicalProjectId });
  await adapter.enumerate();
  await assert.rejects(adapter.read("forged-native-id"), { code: "SOURCE_SCOPE_DENIED" });
  assert.deepEqual(host.calls.map(([name]) => name), ["list"]);
});

test("G2 creates a bounded redacted immutable Source Envelope", async () => {
  const host = hostFixture();
  const adapter = new ScopedSourceAdapter({ host, hostId, canonicalProjectId, budget: { maxThreads: 2, maxDeepReads: 1, maxTurnsPerThread: 1, maxTextPerTurn: 100, maxTotalText: 100 } });
  await adapter.enumerate();
  const envelope = await adapter.read("native-1", "2026-09-04T00:00:00.000Z");
  assert.equal(envelope.projectId, adapter.scopeId);
  assert.match(envelope.contentDigest, /^sha256:/);
  assert.match(envelope.items[0].text, /\[REDACTED_TOKEN\]/);
  assert.match(envelope.items[0].text, /\[REDACTED_EMAIL\]/);
  assert.equal(Object.isFrozen(envelope.items), true);
  await assert.rejects(adapter.read("native-1"), { code: "SOURCE_BUDGET_EXCEEDED" });
});

test("G2 distinguishes missing and unreadable sources", async () => {
  const missingHost = hostFixture();
  missingHost.readThread = async () => { const error = new Error("gone"); error.code = "NOT_FOUND"; throw error; };
  const missing = new ScopedSourceAdapter({ host: missingHost, hostId, canonicalProjectId });
  await missing.enumerate();
  assert.equal((await missing.read("native-1")).availability, "missing");

  const unreadableHost = hostFixture();
  unreadableHost.readThread = async () => { throw new Error("denied"); };
  const unreadable = new ScopedSourceAdapter({ host: unreadableHost, hostId, canonicalProjectId });
  await unreadable.enumerate();
  assert.equal((await unreadable.read("native-1")).availability, "unreadable");
});

test("G2 rejects host reads that start a thread", async () => {
  const host = hostFixture();
  const baseRead = host.readThread;
  host.readThread = async (input) => ({ ...(await baseRead(input)), emittedThreadStarted: true });
  const adapter = new ScopedSourceAdapter({ host, hostId, canonicalProjectId });
  await adapter.enumerate();
  await assert.rejects(adapter.read("native-1"), { code: "SOURCE_READ_SIDE_EFFECT" });
});

test("G2 coalesces equivalent authorized requests and rejects implicit refresh", async () => {
  const coordinator = new IndexRequestCoordinator();
  let runs = 0;
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const request = { scopeId: "prj_x", triggerKind: "initial_graph_open", requestOrigin: "graph", observationCutoff: "2026-09-04T00:00:00.000Z", run: async () => { runs += 1; await pending; return "ok"; } };
  const first = coordinator.request(request);
  const second = coordinator.request(request);
  assert.equal(first, second);
  release();
  assert.equal(await first, "ok");
  assert.equal(runs, 1);
  const published = new IndexRequestCoordinator({ publishedScopes: new Set(["prj_x"]) });
  assert.throws(() => published.request({ ...request, triggerKind: "goal_query" }), { code: "TRIGGER_NOT_AUTHORIZED" });
});

test("G2 contains App Server spawn failures instead of closing the MCP process", async () => {
  const projectPath = mkdtempSync(join(tmpdir(), "threadgraph-host-start-"));
  const host = new CodexAppServerHost({ codexPath: join(projectPath, "missing-codex"), projectPath });
  await assert.rejects(host.listThreads({ projectId: "scope", limit: 1 }), { code: "HOST_START_FAILED" });
  await host.close();
});
