import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { GraphRegistry } from "../../src/registry.mjs";

const scopeId = `prj_${"a".repeat(52)}`;
function revision(idChar, fingerprintChar) {
  return { id: `grv_${idChar.repeat(52)}`, scopeId, fingerprint: `sha256:${fingerprintChar.repeat(64)}`, nodes: [], relations: [] };
}
function registryPath() { return join(mkdtempSync(join(tmpdir(), "threadgraph-registry-")), "graph.db"); }

test("G3 atomically publishes either the old or new complete revision", () => {
  const registry = new GraphRegistry(registryPath());
  const lease = registry.acquireLease(scopeId, "worker-a", 60000);
  const oldRevision = revision("a", "1");
  registry.publish(oldRevision, lease);
  assert.equal(registry.currentRevision(scopeId).id, oldRevision.id);
  assert.throws(() => registry.publish(revision("b", "2"), lease, { faultAt: "after_revision_insert" }), { code: "INJECTED_PUBLICATION_FAILURE" });
  assert.equal(registry.currentRevision(scopeId).id, oldRevision.id);
  registry.close();
});

test("G3 fences stale writers", () => {
  const registry = new GraphRegistry(registryPath());
  const stale = registry.acquireLease(scopeId, "worker-a", 1, 0);
  const current = registry.acquireLease(scopeId, "worker-b", 60000);
  assert.throws(() => registry.publish(revision("a", "1"), stale), { code: "LEASE_FENCED" });
  assert.equal(registry.publish(revision("a", "1"), current).id, revision("a", "1").id);
  registry.close();
});

test("G3 reopens durable current state and recovers interrupted jobs and leases", () => {
  const path = registryPath();
  let registry = new GraphRegistry(path);
  const now = Date.now();
  const lease = registry.acquireLease(scopeId, "worker-a", 10, now);
  registry.publish(revision("a", "1"), lease, { now: "2026-09-04T00:00:00.000Z" });
  const job = registry.createJob({ scopeId, requestFingerprint: "sha256:x", triggerKind: "explicit_refresh" });
  registry.transitionJob(job, "reading");
  registry.close();
  registry = new GraphRegistry(path);
  assert.equal(registry.currentRevision(scopeId).id, revision("a", "1").id);
  assert.deepEqual(registry.recover(now + 20), { interrupted: 1, sessions: 0, expiredPrepared: 0, released: 1 });
  registry.close();
});

test("G3 rejects unsupported triggers and deletes a whole scope", () => {
  const registry = new GraphRegistry(registryPath());
  assert.throws(() => registry.createJob({ scopeId, requestFingerprint: "x", triggerKind: "goal_query" }), { code: "JOB_TRIGGER_INVALID" });
  registry.ensureScope(scopeId);
  assert.equal(registry.deleteScope(scopeId), true);
  assert.equal(registry.currentRevision(scopeId), null);
  registry.close();
});

test("G3 backs up and transactionally upgrades an older registry", () => {
  const path = registryPath();
  const old = new DatabaseSync(path);
  old.exec("CREATE TABLE scopes(scope_id TEXT PRIMARY KEY, current_revision_id TEXT, updated_at TEXT NOT NULL); PRAGMA user_version = 1;");
  old.close();
  const registry = new GraphRegistry(path);
  registry.close();
  assert.equal(existsSync(`${path}.v1.backup`), true);
  const reopened = new DatabaseSync(path);
  assert.equal(reopened.prepare("PRAGMA user_version").get().user_version, 4);
  assert.equal(reopened.prepare("SELECT name FROM sqlite_master WHERE name='context_exports'").get().name, "context_exports");
  assert.equal(reopened.prepare("SELECT name FROM sqlite_master WHERE name='index_sessions'").get().name, "index_sessions");
  assert.equal(reopened.prepare("SELECT name FROM sqlite_master WHERE name='retention_events'").get().name, "retention_events");
  reopened.close();
});

test("G3 rolls back revision, pointer, job, and session as one publication unit", () => {
  const registry = new GraphRegistry(registryPath());
  const firstLease = registry.acquireLease(scopeId, "worker-a", 60000);
  const oldRevision = revision("a", "1");
  registry.publish(oldRevision, firstLease);
  const lease = registry.acquireLease(scopeId, "worker-a", 60000);
  const jobId = registry.createJob({ scopeId, requestFingerprint: "sha256:request", triggerKind: "explicit_refresh" });
  const sessionId = `idx_${"c".repeat(52)}`;
  registry.createIndexSession({ sessionId, scopeId, jobId, requestFingerprint: "sha256:request", sourceDigest: "sha256:source", observationCutoff: "2026-09-04T00:00:00.000Z", payload: {}, lease, expiresAt: Date.now() + 60000 });
  const nextRevision = revision("b", "2");
  assert.throws(() => registry.publishIndexSession(sessionId, nextRevision, { faultAt: "after_pointer_update" }), { code: "INJECTED_PUBLICATION_FAILURE" });
  assert.equal(registry.currentRevision(scopeId).id, oldRevision.id);
  assert.equal(registry.getIndexSession(sessionId).status, "prepared");
  assert.equal(registry.publishIndexSession(sessionId, nextRevision).status, "published");
  assert.equal(registry.currentRevision(scopeId).id, nextRevision.id);
  registry.close();
});
