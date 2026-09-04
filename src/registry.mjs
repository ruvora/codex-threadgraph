import { copyFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { immutableClone } from "./domain/immutable.mjs";

const SCHEMA_VERSION = 1;
const jobStates = new Set(["queued", "reading", "extracting", "linking", "validating", "published", "failed", "cancelled", "interrupted"]);

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

export class GraphRegistry {
  #db;
  #path;

  constructor(path) {
    this.#path = path;
    const existed = existsSync(path);
    this.#db = new DatabaseSync(path);
    this.#db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    const version = this.#db.prepare("PRAGMA user_version").get().user_version;
    if (version > SCHEMA_VERSION) fail("REGISTRY_VERSION_UNSUPPORTED", `Registry version ${version} is newer than supported`);
    if (version < SCHEMA_VERSION) {
      if (existed) copyFileSync(path, `${path}.v${version}.backup`);
      this.#migrate(version);
    }
    const check = this.#db.prepare("PRAGMA integrity_check").get();
    if (check.integrity_check !== "ok") fail("REGISTRY_INTEGRITY_FAILED", check.integrity_check);
  }

  #migrate(from) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      if (from === 0) this.#db.exec(`
        CREATE TABLE IF NOT EXISTS scopes (
          scope_id TEXT PRIMARY KEY,
          current_revision_id TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS graph_revisions (
          revision_id TEXT PRIMARY KEY,
          scope_id TEXT NOT NULL,
          fingerprint TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          published_at TEXT NOT NULL,
          UNIQUE(scope_id, fingerprint),
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS index_jobs (
          job_id TEXT PRIMARY KEY,
          scope_id TEXT NOT NULL,
          request_fingerprint TEXT NOT NULL,
          trigger_kind TEXT NOT NULL CHECK(trigger_kind IN ('initial_graph_open','explicit_refresh')),
          state TEXT NOT NULL,
          attempt INTEGER NOT NULL DEFAULT 0,
          failure_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS writer_leases (
          scope_id TEXT PRIMARY KEY,
          worker_id TEXT NOT NULL,
          lease_token TEXT NOT NULL,
          generation INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE
        );
        PRAGMA user_version = 1;
      `);
      this.#db.exec("COMMIT");
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  ensureScope(scopeId, now = new Date().toISOString()) {
    this.#db.prepare("INSERT OR IGNORE INTO scopes(scope_id, updated_at) VALUES (?, ?)").run(scopeId, now);
  }

  createJob({ scopeId, requestFingerprint, triggerKind, now = new Date().toISOString() }) {
    if (!["initial_graph_open", "explicit_refresh"].includes(triggerKind)) fail("JOB_TRIGGER_INVALID", "Unsupported durable trigger");
    this.ensureScope(scopeId, now);
    const jobId = `job_${randomUUID()}`;
    this.#db.prepare("INSERT INTO index_jobs(job_id, scope_id, request_fingerprint, trigger_kind, state, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', ?, ?)")
      .run(jobId, scopeId, requestFingerprint, triggerKind, now, now);
    return jobId;
  }

  transitionJob(jobId, state, failure = null, now = new Date().toISOString()) {
    if (!jobStates.has(state)) fail("JOB_STATE_INVALID", "Unknown job state");
    const result = this.#db.prepare("UPDATE index_jobs SET state = ?, failure_json = ?, updated_at = ? WHERE job_id = ?")
      .run(state, failure ? JSON.stringify(failure) : null, now, jobId);
    if (result.changes !== 1) fail("JOB_NOT_FOUND", "Index job does not exist");
  }

  acquireLease(scopeId, workerId, ttlMs, nowMs = Date.now()) {
    this.ensureScope(scopeId);
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.#db.prepare("SELECT * FROM writer_leases WHERE scope_id = ?").get(scopeId);
      if (existing && existing.expires_at > nowMs && existing.worker_id !== workerId) fail("LEASE_HELD", "Scope writer lease is active");
      const generation = Number(existing?.generation ?? 0) + 1;
      const leaseToken = randomUUID();
      this.#db.prepare("INSERT INTO writer_leases(scope_id, worker_id, lease_token, generation, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(scope_id) DO UPDATE SET worker_id=excluded.worker_id, lease_token=excluded.lease_token, generation=excluded.generation, expires_at=excluded.expires_at")
        .run(scopeId, workerId, leaseToken, generation, nowMs + ttlMs);
      this.#db.exec("COMMIT");
      return Object.freeze({ scopeId, workerId, leaseToken, generation, expiresAt: nowMs + ttlMs });
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  #assertLease(lease, nowMs = Date.now()) {
    const row = this.#db.prepare("SELECT * FROM writer_leases WHERE scope_id = ?").get(lease.scopeId);
    if (!row || row.worker_id !== lease.workerId || row.lease_token !== lease.leaseToken || row.generation !== lease.generation || row.expires_at <= nowMs) {
      fail("LEASE_FENCED", "Writer lease is missing, expired, or superseded");
    }
  }

  publish(revision, lease, { faultAt = null, now = new Date().toISOString() } = {}) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      this.#assertLease(lease);
      this.#db.prepare("INSERT OR IGNORE INTO graph_revisions(revision_id, scope_id, fingerprint, payload_json, published_at) VALUES (?, ?, ?, ?, ?)")
        .run(revision.id, revision.scopeId, revision.fingerprint, JSON.stringify(revision), now);
      if (faultAt === "after_revision_insert") fail("INJECTED_PUBLICATION_FAILURE", "Injected publication interruption");
      this.#db.prepare("UPDATE scopes SET current_revision_id = ?, updated_at = ? WHERE scope_id = ?")
        .run(revision.id, now, revision.scopeId);
      if (faultAt === "after_pointer_update") fail("INJECTED_PUBLICATION_FAILURE", "Injected publication interruption");
      this.#db.exec("COMMIT");
      return this.currentRevision(revision.scopeId);
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  currentRevision(scopeId) {
    const row = this.#db.prepare("SELECT r.payload_json FROM scopes s LEFT JOIN graph_revisions r ON r.revision_id=s.current_revision_id WHERE s.scope_id=?").get(scopeId);
    return row?.payload_json ? immutableClone(JSON.parse(row.payload_json)) : null;
  }

  recover(nowMs = Date.now()) {
    const interrupted = this.#db.prepare("UPDATE index_jobs SET state='interrupted', updated_at=? WHERE state IN ('reading','extracting','linking','validating')")
      .run(new Date(nowMs).toISOString()).changes;
    const released = this.#db.prepare("DELETE FROM writer_leases WHERE expires_at <= ?").run(nowMs).changes;
    return Object.freeze({ interrupted, released });
  }

  deleteThread(scopeId, threadId) {
    const revision = this.currentRevision(scopeId);
    if (!revision) return false;
    if (revision.nodes.some((node) => node.id === threadId)) fail("THREAD_DELETE_REQUIRES_REVISION", "Thread deletion must publish an invalidating graph revision");
    return false;
  }

  deleteScope(scopeId) {
    return this.#db.prepare("DELETE FROM scopes WHERE scope_id=?").run(scopeId).changes === 1;
  }

  close() { this.#db.close(); }
}

export { SCHEMA_VERSION };
