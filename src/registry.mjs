import { copyFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { immutableClone } from "./domain/immutable.mjs";

const SCHEMA_VERSION = 4;
const jobStates = new Set(["queued", "reading", "extracting", "linking", "validating", "published", "failed", "cancelled", "interrupted"]);

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function retainedSessionPayload(payload) {
  const request = payload?.request ?? {};
  return {
    schemaVersion: "retained-index-session/1",
    scopeId: request.scopeId ?? null,
    triggerKind: request.triggerKind ?? null,
    observationCutoff: request.observationCutoff ?? null,
    parentRevisionId: request.parentRevisionId ?? null,
    memberCount: Array.isArray(payload?.members) ? payload.members.length : 0,
    sourceCount: Array.isArray(payload?.sources) ? payload.sources.length : 0,
    semanticSourceCount: Array.isArray(payload?.semanticSourceIds) ? payload.semanticSourceIds.length : 0,
  };
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
      `);
      if (from <= 1) this.#db.exec(`
        CREATE TABLE IF NOT EXISTS context_exports (
          pack_id TEXT PRIMARY KEY,
          scope_id TEXT NOT NULL,
          graph_revision_id TEXT NOT NULL,
          content_digest TEXT NOT NULL,
          manifest_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(graph_revision_id, content_digest),
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE
        );
      `);
      if (from <= 2) this.#db.exec(`
        CREATE TABLE IF NOT EXISTS semantic_entities (
          scope_id TEXT NOT NULL,
          subject_key TEXT NOT NULL,
          entity_id TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          PRIMARY KEY(scope_id, subject_key),
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS index_sessions (
          session_id TEXT PRIMARY KEY,
          scope_id TEXT NOT NULL,
          job_id TEXT NOT NULL UNIQUE,
          request_fingerprint TEXT NOT NULL,
          source_digest TEXT NOT NULL,
          observation_cutoff TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('prepared','publishing','published','cancelled','failed','interrupted')),
          payload_json TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          lease_token TEXT NOT NULL,
          lease_generation INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          result_revision_id TEXT,
          failure_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE,
          FOREIGN KEY(job_id) REFERENCES index_jobs(job_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS index_sessions_scope_status ON index_sessions(scope_id, status);
      `);
      if (from <= 3) this.#db.exec(`
        CREATE TABLE IF NOT EXISTS retention_events (
          event_id TEXT PRIMARY KEY,
          scope_id TEXT NOT NULL,
          operation TEXT NOT NULL CHECK(operation IN ('thread_delete')),
          target_thread_id TEXT NOT NULL,
          previous_revision_id TEXT NOT NULL,
          result_revision_id TEXT NOT NULL,
          counts_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY(scope_id) REFERENCES scopes(scope_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS retention_events_scope ON retention_events(scope_id, created_at);
        PRAGMA user_version = 4;
      `);
      if (from <= 3) {
        const terminalRows = this.#db.prepare("SELECT session_id, payload_json FROM index_sessions WHERE status IN ('published','cancelled','failed','interrupted')").all();
        for (const row of terminalRows) this.#db.prepare("UPDATE index_sessions SET payload_json=? WHERE session_id=?")
          .run(JSON.stringify(retainedSessionPayload(JSON.parse(row.payload_json))), row.session_id);
      }
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

  releaseLease(lease) {
    return this.#db.prepare("DELETE FROM writer_leases WHERE scope_id=? AND worker_id=? AND lease_token=? AND generation=?")
      .run(lease.scopeId, lease.workerId, lease.leaseToken, lease.generation).changes === 1;
  }

  createIndexSession(session, now = new Date().toISOString()) {
    this.#assertLease(session.lease);
    this.#db.prepare(`INSERT INTO index_sessions(
      session_id, scope_id, job_id, request_fingerprint, source_digest, observation_cutoff,
      status, payload_json, worker_id, lease_token, lease_generation, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'prepared', ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        session.sessionId, session.scopeId, session.jobId, session.requestFingerprint,
        session.sourceDigest, session.observationCutoff, JSON.stringify(session.payload),
        session.lease.workerId, session.lease.leaseToken, session.lease.generation,
        session.expiresAt, now, now,
      );
    return this.getIndexSession(session.sessionId);
  }

  resolveSemanticEntity(scopeId, subjectKey, createId, now = new Date().toISOString()) {
    this.ensureScope(scopeId, now);
    const existing = this.#db.prepare("SELECT entity_id FROM semantic_entities WHERE scope_id=? AND subject_key=?").get(scopeId, subjectKey);
    if (existing) return existing.entity_id;
    const entityId = createId();
    this.#db.prepare("INSERT OR IGNORE INTO semantic_entities(scope_id, subject_key, entity_id, created_at) VALUES (?, ?, ?, ?)")
      .run(scopeId, subjectKey, entityId, now);
    return this.#db.prepare("SELECT entity_id FROM semantic_entities WHERE scope_id=? AND subject_key=?").get(scopeId, subjectKey).entity_id;
  }

  getIndexSession(sessionId) {
    const row = this.#db.prepare("SELECT * FROM index_sessions WHERE session_id=?").get(sessionId);
    if (!row) return null;
    return immutableClone({
      sessionId: row.session_id,
      scopeId: row.scope_id,
      jobId: row.job_id,
      requestFingerprint: row.request_fingerprint,
      sourceDigest: row.source_digest,
      observationCutoff: row.observation_cutoff,
      status: row.status,
      payload: JSON.parse(row.payload_json),
      lease: { scopeId: row.scope_id, workerId: row.worker_id, leaseToken: row.lease_token, generation: row.lease_generation, expiresAt: row.expires_at },
      expiresAt: row.expires_at,
      resultRevisionId: row.result_revision_id ?? null,
      failure: row.failure_json ? JSON.parse(row.failure_json) : null,
    });
  }

  failIndexSession(sessionId, failure, now = new Date().toISOString()) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const session = this.getIndexSession(sessionId);
      if (!session) fail("INDEX_SESSION_NOT_FOUND", "Index session does not exist");
      if (!["prepared", "publishing"].includes(session.status)) fail("INDEX_SESSION_TERMINAL", "Index session is not active");
      this.#db.prepare("UPDATE index_sessions SET status='failed', payload_json=?, failure_json=?, updated_at=? WHERE session_id=?")
        .run(JSON.stringify(retainedSessionPayload(session.payload)), JSON.stringify(failure), now, sessionId);
      this.#db.prepare("UPDATE index_jobs SET state='failed', failure_json=?, updated_at=? WHERE job_id=?")
        .run(JSON.stringify(failure), now, session.jobId);
      this.#db.prepare("DELETE FROM writer_leases WHERE scope_id=? AND worker_id=? AND lease_token=? AND generation=?")
        .run(session.scopeId, session.lease.workerId, session.lease.leaseToken, session.lease.generation);
      this.#db.exec("COMMIT");
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  cancelIndexSession(sessionId, now = new Date().toISOString()) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const session = this.getIndexSession(sessionId);
      if (!session) fail("INDEX_SESSION_NOT_FOUND", "Index session does not exist");
      if (session.status !== "prepared") fail("INDEX_SESSION_TERMINAL", "Only a prepared session can be cancelled");
      this.#db.prepare("UPDATE index_sessions SET status='cancelled', payload_json=?, updated_at=? WHERE session_id=?")
        .run(JSON.stringify(retainedSessionPayload(session.payload)), now, sessionId);
      this.#db.prepare("UPDATE index_jobs SET state='cancelled', updated_at=? WHERE job_id=?").run(now, session.jobId);
      this.#db.prepare("DELETE FROM writer_leases WHERE scope_id=? AND worker_id=? AND lease_token=? AND generation=?")
        .run(session.scopeId, session.lease.workerId, session.lease.leaseToken, session.lease.generation);
      this.#db.exec("COMMIT");
      return this.getIndexSession(sessionId);
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  publishIndexSession(sessionId, revision, { faultAt = null, now = new Date().toISOString(), nowMs = Date.now() } = {}) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const session = this.getIndexSession(sessionId);
      if (!session) fail("INDEX_SESSION_NOT_FOUND", "Index session does not exist");
      if (session.status !== "prepared") fail("INDEX_SESSION_TERMINAL", "Index session cannot publish again");
      if (session.expiresAt <= nowMs) fail("INDEX_SESSION_EXPIRED", "Index session has expired");
      if (revision.scopeId !== session.scopeId) fail("INDEX_SESSION_SCOPE_MISMATCH", "Revision scope differs from the prepared session");
      this.#assertLease(session.lease, nowMs);
      this.#db.prepare("UPDATE index_sessions SET status='publishing', updated_at=? WHERE session_id=?").run(now, sessionId);
      this.#db.prepare("INSERT OR IGNORE INTO graph_revisions(revision_id, scope_id, fingerprint, payload_json, published_at) VALUES (?, ?, ?, ?, ?)")
        .run(revision.id, revision.scopeId, revision.fingerprint, JSON.stringify(revision), now);
      if (faultAt === "after_revision_insert") fail("INJECTED_PUBLICATION_FAILURE", "Injected publication interruption");
      this.#db.prepare("UPDATE scopes SET current_revision_id=?, updated_at=? WHERE scope_id=?").run(revision.id, now, revision.scopeId);
      this.#db.prepare("UPDATE index_sessions SET status='published', payload_json=?, result_revision_id=?, updated_at=? WHERE session_id=?")
        .run(JSON.stringify(retainedSessionPayload(session.payload)), revision.id, now, sessionId);
      this.#db.prepare("UPDATE index_jobs SET state='published', updated_at=? WHERE job_id=?").run(now, session.jobId);
      this.#db.prepare("DELETE FROM writer_leases WHERE scope_id=? AND worker_id=? AND lease_token=? AND generation=?")
        .run(session.scopeId, session.lease.workerId, session.lease.leaseToken, session.lease.generation);
      if (faultAt === "after_pointer_update") fail("INJECTED_PUBLICATION_FAILURE", "Injected publication interruption");
      this.#db.exec("COMMIT");
      return this.getIndexSession(sessionId);
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
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

  retentionSummary(scopeId) {
    const revision = this.currentRevision(scopeId);
    const sessions = this.#db.prepare("SELECT status, payload_json FROM index_sessions WHERE scope_id=?").all(scopeId);
    const rawSourceSessions = sessions.filter((row) => Array.isArray(JSON.parse(row.payload_json)?.sources)).length;
    return immutableClone({
      scopeId,
      sourceTextPolicy: "temporary_prepared_session_only",
      currentRevisionId: revision?.id ?? null,
      currentThreadCount: revision?.nodes?.filter((node) => node.kind === "thread").length ?? 0,
      revisionCount: this.#db.prepare("SELECT COUNT(*) AS count FROM graph_revisions WHERE scope_id=?").get(scopeId).count,
      exportCount: this.#db.prepare("SELECT COUNT(*) AS count FROM context_exports WHERE scope_id=?").get(scopeId).count,
      activePreparedSessions: sessions.filter((row) => row.status === "prepared").length,
      terminalSessions: sessions.filter((row) => ["published", "cancelled", "failed", "interrupted"].includes(row.status)).length,
      sessionsContainingTemporarySources: rawSourceSessions,
      retentionEventCount: this.#db.prepare("SELECT COUNT(*) AS count FROM retention_events WHERE scope_id=?").get(scopeId).count,
    });
  }

  publishThreadDeletion(revision, lease, threadId, counts, { now = new Date().toISOString() } = {}) {
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      this.#assertLease(lease);
      const current = this.currentRevision(revision.scopeId);
      if (!current || current.id !== revision.parentRevisionId) fail("THREAD_DELETE_REVISION_STALE", "Deletion preview no longer matches the current revision");
      this.#db.prepare("INSERT INTO graph_revisions(revision_id, scope_id, fingerprint, payload_json, published_at) VALUES (?, ?, ?, ?, ?)")
        .run(revision.id, revision.scopeId, revision.fingerprint, JSON.stringify(revision), now);
      this.#db.prepare("UPDATE scopes SET current_revision_id=?, updated_at=? WHERE scope_id=?").run(revision.id, now, revision.scopeId);
      const removedRevisionIds = [];
      for (const row of this.#db.prepare("SELECT revision_id, payload_json FROM graph_revisions WHERE scope_id=? AND revision_id<>?").all(revision.scopeId, revision.id)) {
        const payload = JSON.parse(row.payload_json);
        if (payload.nodes?.some((node) => node.id === threadId) || payload.observations?.some((observation) => observation.threadId === threadId)) removedRevisionIds.push(row.revision_id);
      }
      for (const revisionId of removedRevisionIds) {
        this.#db.prepare("DELETE FROM context_exports WHERE graph_revision_id=?").run(revisionId);
        this.#db.prepare("DELETE FROM graph_revisions WHERE revision_id=?").run(revisionId);
      }
      const retainedSubjectKeys = new Set(revision.nodes.filter((node) => node.kind === "topic").map((node) => node.canonicalSubjectKey));
      for (const row of this.#db.prepare("SELECT subject_key FROM semantic_entities WHERE scope_id=?").all(revision.scopeId)) {
        if (!retainedSubjectKeys.has(row.subject_key)) this.#db.prepare("DELETE FROM semantic_entities WHERE scope_id=? AND subject_key=?").run(revision.scopeId, row.subject_key);
      }
      const eventId = `ret_${randomUUID()}`;
      const resultCounts = { ...counts, purgedRevisionCount: removedRevisionIds.length };
      this.#db.prepare("INSERT INTO retention_events(event_id, scope_id, operation, target_thread_id, previous_revision_id, result_revision_id, counts_json, created_at) VALUES (?, ?, 'thread_delete', ?, ?, ?, ?, ?)")
        .run(eventId, revision.scopeId, threadId, revision.parentRevisionId, revision.id, JSON.stringify(resultCounts), now);
      this.#db.prepare("DELETE FROM writer_leases WHERE scope_id=? AND worker_id=? AND lease_token=? AND generation=?")
        .run(lease.scopeId, lease.workerId, lease.leaseToken, lease.generation);
      this.#db.exec("COMMIT");
      return immutableClone({ eventId, scopeId: revision.scopeId, threadId, previousRevisionId: revision.parentRevisionId, revisionId: revision.id, counts: resultCounts });
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }

  recover(nowMs = Date.now()) {
    const interrupted = this.#db.prepare("UPDATE index_jobs SET state='interrupted', updated_at=? WHERE state IN ('reading','extracting','linking','validating')")
      .run(new Date(nowMs).toISOString()).changes;
    const publishing = this.#db.prepare("SELECT session_id, payload_json FROM index_sessions WHERE status='publishing'").all();
    for (const row of publishing) this.#db.prepare("UPDATE index_sessions SET status='interrupted', payload_json=?, updated_at=? WHERE session_id=?")
      .run(JSON.stringify(retainedSessionPayload(JSON.parse(row.payload_json))), new Date(nowMs).toISOString(), row.session_id);
    const sessions = publishing.length;
    const expired = this.#db.prepare("SELECT session_id, job_id, payload_json FROM index_sessions WHERE status='prepared' AND expires_at<=?").all(nowMs);
    for (const row of expired) {
      const failure = JSON.stringify({ code: "INDEX_SESSION_EXPIRED", message: "Prepared session expired before recovery" });
      this.#db.prepare("UPDATE index_sessions SET status='failed', payload_json=?, failure_json=?, updated_at=? WHERE session_id=?")
        .run(JSON.stringify(retainedSessionPayload(JSON.parse(row.payload_json))), failure, new Date(nowMs).toISOString(), row.session_id);
      this.#db.prepare("UPDATE index_jobs SET state='failed', failure_json=?, updated_at=? WHERE job_id=?")
        .run(failure, new Date(nowMs).toISOString(), row.job_id);
    }
    const released = this.#db.prepare("DELETE FROM writer_leases WHERE expires_at <= ?").run(nowMs).changes;
    return Object.freeze({ interrupted, sessions, expiredPrepared: expired.length, released });
  }

  recordExport(pack, now = new Date().toISOString()) {
    this.ensureScope(pack.scopeId, now);
    this.#db.prepare("INSERT OR IGNORE INTO context_exports(pack_id, scope_id, graph_revision_id, content_digest, manifest_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(pack.packId, pack.scopeId, pack.graphRevisionId, pack.contentDigest, JSON.stringify(pack), now);
    const row = this.#db.prepare("SELECT manifest_json FROM context_exports WHERE graph_revision_id=? AND content_digest=?")
      .get(pack.graphRevisionId, pack.contentDigest);
    return immutableClone(JSON.parse(row.manifest_json));
  }

  deleteScope(scopeId) {
    return this.#db.prepare("DELETE FROM scopes WHERE scope_id=?").run(scopeId).changes === 1;
  }

  close() { this.#db.close(); }
}

export { SCHEMA_VERSION };
