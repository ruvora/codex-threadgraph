import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fingerprint } from "../../src/domain/hashing.mjs";
import { IndexingPipeline } from "../../src/indexing-pipeline.mjs";
import { GraphRegistry } from "../../src/registry.mjs";
import { GraphService } from "../../src/graph-service.mjs";

function registryFixture() {
  const path = join(mkdtempSync(join(tmpdir(), "threadgraph-pipeline-")), "graph.db");
  return { path, registry: new GraphRegistry(path) };
}

function hostFixture() {
  let visible = ["native-a", "native-b"];
  const calls = [];
  let scopeId;
  return {
    calls,
    hide(id) { visible = visible.filter((item) => item !== id); },
    async listThreads({ projectId }) {
      scopeId = projectId;
      calls.push(["list", projectId]);
      return visible.map((id, index) => ({ id, projectId, title: id, updatedAt: "2026-09-04T00:00:00.000Z", parentThreadId: index === 1 ? "native-a" : null }));
    },
    async readThread({ threadId }) {
      calls.push(["read", threadId]);
      return {
        id: threadId,
        projectId: scopeId,
        updatedAt: "2026-09-04T00:00:00.000Z",
        statusBefore: "notLoaded",
        statusAfter: "notLoaded",
        emittedThreadStarted: false,
        turns: [{ id: `${threadId}-turn`, status: "completed", items: [{ role: "user", type: "message", text: "Discuss the shared database topic." }] }],
      };
    },
  };
}

function extractionFor(source) {
  return {
    schemaVersion: "extraction/1-alpha",
    sourceEnvelopeDigest: fingerprint("source-envelope/1", source),
    extractorVersion: "extractor/1-alpha",
    claims: [{ kind: "topic", subjectCandidate: "Database", modality: "asserted", polarity: "affirm", lifecycle: "active", evidenceLocators: [source.items[0].locator] }],
    aliases: [], relationCandidates: [], warnings: [],
  };
}

test("G9 prepare and publish connect scoped sources to one atomic Graph Revision", async () => {
  const { registry } = registryFixture();
  const host = hostFixture();
  const pipeline = new IndexingPipeline({ registry, host, hostId: "local", canonicalProjectId: "/repo", workerId: "worker-a" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.sources.length, 2);
  assert.equal(registry.currentRevision(prepared.scopeId), null);
  const result = await pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(extractionFor) });
  assert.equal(result.status, "published");
  assert.equal(result.graph.nodes.filter((node) => node.kind === "thread").length, 2);
  assert.equal(result.graph.nodes.find((node) => node.kind === "thread").nativeThreadId.startsWith("native-"), true);
  assert.equal(result.graph.relations.some((edge) => edge.kind === "forked_from" && edge.evidenceClass === "observed"), true);
  assert.equal(result.graph.relations.some((edge) => edge.kind === "related_to" && edge.evidenceClass === "inferred"), true);
  const selection = new GraphService({ registry }).query(prepared.scopeId, { objective: "Continue database work", requirements: [{ subject: "database", importance: "required", sourceSpan: "database" }] });
  assert.equal(selection.result, "ambiguous");
  assert.equal(selection.candidates.length, 2);
  assert.equal(host.calls.some(([name]) => name === "read"), true);
  registry.close();
});

test("G9 a Graph Query cannot authorize indexing and initial open cannot overwrite a graph", async () => {
  const { registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo" });
  await assert.rejects(pipeline.prepare({ triggerKind: "goal_query", requestOrigin: "query" }), { code: "TRIGGER_NOT_AUTHORIZED" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  await pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(extractionFor) });
  await assert.rejects(pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T02:00:00.000Z" }), { code: "REVISION_ALREADY_EXISTS" });
  registry.close();
});

test("G9 extraction from another session fails terminally before publication", async () => {
  const { registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  const forged = prepared.sources.map(extractionFor);
  forged[0].sourceEnvelopeDigest = `sha256:${"f".repeat(64)}`;
  await assert.rejects(pipeline.publish({ sessionId: prepared.sessionId, extractions: forged }), { code: "EXTRACTION_SOURCE_MISMATCH" });
  assert.equal(registry.getIndexSession(prepared.sessionId).status, "failed");
  assert.equal(registry.currentRevision(prepared.scopeId), null);
  await assert.rejects(pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(extractionFor) }), { code: "INDEX_SESSION_TERMINAL" });
  registry.close();
});

test("G9 persisted session tampering is detected before graph construction", async () => {
  const { path, registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  const attacker = new DatabaseSync(path);
  const row = attacker.prepare("SELECT payload_json FROM index_sessions WHERE session_id=?").get(prepared.sessionId);
  const payload = JSON.parse(row.payload_json);
  payload.request.requestOrigin = "tampered";
  attacker.prepare("UPDATE index_sessions SET payload_json=? WHERE session_id=?").run(JSON.stringify(payload), prepared.sessionId);
  attacker.close();
  await assert.rejects(pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(extractionFor) }), { code: "INDEX_SESSION_FINGERPRINT_MISMATCH" });
  assert.equal(registry.currentRevision(prepared.scopeId), null);
  registry.close();
});

test("G9 scope is revalidated immediately before publication", async () => {
  const { registry } = registryFixture();
  const host = hostFixture();
  const pipeline = new IndexingPipeline({ registry, host, hostId: "local", canonicalProjectId: "/repo" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  host.hide("native-b");
  await assert.rejects(pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(extractionFor) }), { code: "SOURCE_SCOPE_REVALIDATION_FAILED" });
  assert.equal(registry.currentRevision(prepared.scopeId), null);
  registry.close();
});

test("G9 cancellation is terminal and releases the prepared session", async () => {
  const { registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  assert.equal(pipeline.cancel(prepared.sessionId).status, "cancelled");
  await assert.rejects(pipeline.publish({ sessionId: prepared.sessionId, extractions: [] }), { code: "INDEX_SESSION_TERMINAL" });
  registry.close();
});

test("G9 source preparation failure releases the writer lease", async () => {
  const { registry } = registryFixture();
  const brokenHost = hostFixture();
  brokenHost.listThreads = async () => { throw Object.assign(new Error("host unavailable"), { code: "HOST_UNAVAILABLE" }); };
  const broken = new IndexingPipeline({ registry, host: brokenHost, hostId: "local", canonicalProjectId: "/repo", workerId: "broken-worker" });
  await assert.rejects(broken.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" }), { code: "HOST_UNAVAILABLE" });
  const recovered = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo", workerId: "recovery-worker" });
  const prepared = await recovered.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  assert.equal(prepared.status, "prepared");
  registry.close();
});

test("G9 explicit refresh links a new revision to the current parent", async () => {
  const { registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo" });
  const first = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  const firstResult = await pipeline.publish({ sessionId: first.sessionId, extractions: first.sources.map(extractionFor) });
  const refresh = await pipeline.prepare({ triggerKind: "explicit_refresh", requestOrigin: "refresh_button", observationCutoff: "2026-09-04T02:00:00.000Z" });
  const refreshResult = await pipeline.publish({ sessionId: refresh.sessionId, extractions: refresh.sources.map(extractionFor) });
  assert.equal(refreshResult.graph.parentRevisionId, firstResult.revisionId);
  assert.notEqual(refreshResult.revisionId, firstResult.revisionId);
  registry.close();
});

test("G9 an expired prepared session cannot publish", async () => {
  const { registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo", sessionTtlMs: 20 });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "graph_open", observationCutoff: "2026-09-04T01:00:00.000Z" });
  await new Promise((resolve) => setTimeout(resolve, 30));
  await assert.rejects(pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(extractionFor) }), { code: "INDEX_SESSION_EXPIRED" });
  assert.equal(registry.getIndexSession(prepared.sessionId).status, "failed");
  assert.equal(registry.currentRevision(prepared.scopeId), null);
  registry.close();
});
