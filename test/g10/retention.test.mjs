import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { fingerprint } from "../../src/domain/hashing.mjs";
import { GraphService } from "../../src/graph-service.mjs";
import { IndexingPipeline } from "../../src/indexing-pipeline.mjs";
import { GraphRegistry } from "../../src/registry.mjs";

function registryFixture() {
  const path = join(mkdtempSync(join(tmpdir(), "threadgraph-retention-")), "graph.db");
  return { path, registry: new GraphRegistry(path) };
}

function hostFixture() {
  const members = ["native-a", "native-b"];
  let listedProjectId;
  return {
    async listThreads({ projectId }) {
      listedProjectId = projectId;
      return members.map((id) => ({ id, projectId, title: id, updatedAt: "2026-09-04T00:00:00.000Z", parentThreadId: null }));
    },
    async readThread({ threadId }) {
      return { id: threadId, projectId: listedProjectId, updatedAt: "2026-09-04T00:00:00.000Z", statusBefore: "notLoaded", statusAfter: "notLoaded", emittedThreadStarted: false, turns: [{ id: `${threadId}-turn`, status: "completed", items: [{ role: "user", type: "message", text: `private-source-text-${threadId}` }] }] };
    },
  };
}

function emptyExtraction(source) {
  return { schemaVersion: "extraction/1-alpha", sourceEnvelopeDigest: fingerprint("source-envelope/1", source), extractorVersion: "extractor/1-alpha", claims: [], aliases: [], relationCandidates: [], warnings: [] };
}

async function publishFixture(registry) {
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo", workerId: "retention-indexer" });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "retention_test", observationCutoff: "2026-09-04T01:00:00.000Z" });
  const published = await pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(emptyExtraction) });
  return { prepared, published };
}

test("G10 terminal sessions scrub temporary source text", async () => {
  const { path, registry } = registryFixture();
  const { prepared } = await publishFixture(registry);
  const retained = registry.getIndexSession(prepared.sessionId);
  assert.equal(retained.payload.schemaVersion, "retained-index-session/1");
  assert.equal("sources" in retained.payload, false);
  assert.equal(JSON.stringify(retained).includes("private-source-text"), false);
  assert.equal(registry.retentionSummary(prepared.scopeId).sessionsContainingTemporarySources, 0);

  const refresh = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo", workerId: "retention-cancel" });
  const cancelled = await refresh.prepare({ triggerKind: "explicit_refresh", requestOrigin: "cancel_test", observationCutoff: "2026-09-04T02:00:00.000Z" });
  refresh.cancel(cancelled.sessionId);
  assert.equal(JSON.stringify(registry.getIndexSession(cancelled.sessionId)).includes("private-source-text"), false);
  registry.close();

  const legacy = new DatabaseSync(path);
  legacy.prepare("UPDATE index_sessions SET payload_json=? WHERE session_id=?").run(JSON.stringify({ sources: [{ text: "legacy-private-source-text" }] }), prepared.sessionId);
  legacy.exec("PRAGMA user_version = 3");
  legacy.close();
  const migrated = new GraphRegistry(path);
  assert.equal(JSON.stringify(migrated.getIndexSession(prepared.sessionId)).includes("legacy-private-source-text"), false);
  migrated.close();
});

test("G10 recovery expires and scrubs abandoned prepared sessions", async () => {
  const { registry } = registryFixture();
  const pipeline = new IndexingPipeline({ registry, host: hostFixture(), hostId: "local", canonicalProjectId: "/repo", workerId: "abandoned-indexer", sessionTtlMs: 1_000 });
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "abandoned_test", observationCutoff: "2026-09-04T01:00:00.000Z" });
  const recovered = registry.recover(Date.now() + 2_000);
  assert.equal(recovered.expiredPrepared, 1);
  const session = registry.getIndexSession(prepared.sessionId);
  assert.equal(session.status, "failed");
  assert.equal(session.payload.schemaVersion, "retained-index-session/1");
  assert.equal(JSON.stringify(session).includes("private-source-text"), false);
  registry.close();
});

test("G10 thread deletion requires a current preview and publishes a purged revision", async () => {
  const { registry } = registryFixture();
  const { prepared } = await publishFixture(registry);
  const service = new GraphService({ registry });
  const before = service.getGraph(prepared.scopeId).revision;
  const target = before.nodes.find((node) => node.kind === "thread" && node.nativeThreadId === "native-a");
  const survivor = before.nodes.find((node) => node.kind === "thread" && node.nativeThreadId === "native-b");
  const preview = service.previewThreadDeletion(prepared.scopeId, target.id);
  assert.equal(preview.state, "confirmation_required");
  assert.equal(preview.nativeThreadHistoryChanged, false);
  assert.ok(preview.counts.removedEvidenceItems > 0);
  assert.throws(() => service.deleteIndexedThread(prepared.scopeId, target.id, { explicitUserAction: false, confirmationToken: preview.confirmationToken }), { code: "THREAD_DELETE_AUTHORIZATION_REQUIRED" });
  assert.throws(() => service.deleteIndexedThread(prepared.scopeId, target.id, { explicitUserAction: true, confirmationToken: "sha256:stale" }), { code: "THREAD_DELETE_CONFIRMATION_STALE" });

  const result = service.deleteIndexedThread(prepared.scopeId, target.id, { explicitUserAction: true, confirmationToken: preview.confirmationToken });
  assert.equal(result.state, "deleted");
  assert.equal(result.nativeThreadHistoryChanged, false);
  const after = service.getGraph(prepared.scopeId).revision;
  assert.equal(after.parentRevisionId, before.id);
  assert.equal(after.nodes.some((node) => node.id === target.id), false);
  assert.equal(after.nodes.some((node) => node.id === survivor.id), true);
  assert.equal(after.observations.some((observation) => observation.threadId === target.id), false);
  assert.equal(after.relations.some((relation) => relation.sourceId === target.id || relation.targetId === target.id), false);
  const summary = service.getRetention(prepared.scopeId);
  assert.equal(summary.revisionCount, 1);
  assert.equal(summary.retentionEventCount, 1);
  registry.close();
});

test("G10 graph UI exposes preview-first deletion and states the native-history boundary", () => {
  const html = readFileSync(new URL("../../ui/graph.html", import.meta.url), "utf8");
  assert.match(html, /threadgraph:preview-thread-deletion/);
  assert.match(html, /confirmationToken/);
  assert.match(html, /explicitUserAction:true/);
  assert.match(html, /native Codex thread and its history will not be changed/i);
});
