import { deriveStableId } from "./contracts/identity.mjs";
import { authorizeIndexUpdate } from "./contracts/index-trigger.mjs";
import { fingerprint } from "./domain/hashing.mjs";
import { immutableClone } from "./domain/immutable.mjs";

const DEFAULT_BUDGET = Object.freeze({
  maxThreads: 100,
  maxDeepReads: 12,
  maxTurnsPerThread: 8,
  maxTextPerTurn: 2500,
  maxTotalText: 120000,
});

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  throw error;
}

function requireHost(host) {
  for (const method of ["listThreads", "readThread"]) {
    if (typeof host?.[method] !== "function") fail("HOST_CAPABILITY_UNSUPPORTED", `Host lacks ${method}`);
  }
}

function normalizeBudget(input = {}) {
  const budget = { ...DEFAULT_BUDGET, ...input };
  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isInteger(value) || value < 0 || value > DEFAULT_BUDGET[name]) {
      fail("SOURCE_BUDGET_INVALID", `${name} exceeds index-policy/1-alpha`, { name, value });
    }
  }
  return Object.freeze(budget);
}

function canonicalProjectIdentity(hostId, canonicalProjectId) {
  if (typeof hostId !== "string" || !hostId || typeof canonicalProjectId !== "string" || !canonicalProjectId) {
    fail("SOURCE_SCOPE_INVALID", "Host and canonical project identities are required");
  }
  return deriveStableId({ kind: "project", hostId, canonicalProjectId }).id;
}

function redact(text) {
  return String(text ?? "")
    .replace(/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_\-]{12,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
}

function boundedItems(thread, budget, remainingText) {
  const turns = [...(thread.turns ?? [])].filter((turn) => turn.status === "completed").slice(-budget.maxTurnsPerThread);
  const items = [];
  let used = 0;
  for (const turn of turns) {
    for (const [index, item] of (turn.items ?? []).entries()) {
      const allowance = Math.max(0, Math.min(budget.maxTextPerTurn, remainingText - used));
      if (allowance === 0) return { items, used, partial: true };
      const text = redact(item.text ?? item.content ?? "").slice(0, allowance);
      used += text.length;
      items.push({
        locator: `${turn.id}:item-${index}`,
        role: ["user", "assistant", "system", "tool"].includes(item.role) ? item.role : "tool",
        type: String(item.type ?? "unknown"),
        text,
        ...(item.terminalStatus !== undefined ? { terminalStatus: item.terminalStatus } : {}),
        ...(item.artifactReference ? { artifactReference: String(item.artifactReference) } : {}),
      });
    }
  }
  return { items, used, partial: false };
}

export class ScopedSourceAdapter {
  #host;
  #hostId;
  #scope;
  #budget;
  #members = new Map();
  #remainingText;
  #deepReads = 0;

  constructor({ host, hostId, canonicalProjectId, budget }) {
    requireHost(host);
    this.#host = host;
    this.#hostId = hostId;
    this.#scope = canonicalProjectIdentity(hostId, canonicalProjectId);
    this.#budget = normalizeBudget(budget);
    this.#remainingText = this.#budget.maxTotalText;
  }

  get scopeId() { return this.#scope; }

  async enumerate() {
    const native = await this.#host.listThreads({ projectId: this.#scope, limit: this.#budget.maxThreads });
    if (!Array.isArray(native)) fail("HOST_RESPONSE_INVALID", "Thread list must be an array");
    this.#members.clear();
    for (const item of native.slice(0, this.#budget.maxThreads)) {
      if (item.projectId !== this.#scope || typeof item.id !== "string") continue;
      const id = deriveStableId({ kind: "thread", hostId: this.#hostId, nativeThreadId: item.id }).id;
      this.#members.set(item.id, immutableClone({
        id,
        nativeThreadId: item.id,
        projectId: this.#scope,
        title: String(item.title ?? ""),
        updatedAt: item.updatedAt ?? null,
        parentNativeThreadId: item.parentThreadId ?? null,
        availability: "readable",
      }));
    }
    return immutableClone([...this.#members.values()]);
  }

  async read(nativeThreadId, observedAt = new Date().toISOString()) {
    const member = this.#members.get(nativeThreadId);
    if (!member) fail("SOURCE_SCOPE_DENIED", "Thread was not authorized by scoped enumeration", { nativeThreadId });
    if (this.#deepReads >= this.#budget.maxDeepReads) fail("SOURCE_BUDGET_EXCEEDED", "Deep-read budget exhausted");
    this.#deepReads += 1;
    let thread;
    try {
      thread = await this.#host.readThread({ threadId: nativeThreadId, includeTurns: true });
    } catch (error) {
      return immutableClone({ ...member, availability: error?.code === "NOT_FOUND" ? "missing" : "unreadable" });
    }
    if (!thread || thread.id !== nativeThreadId) return immutableClone({ ...member, availability: "missing" });
    if (thread.projectId !== this.#scope) fail("SOURCE_SCOPE_CHANGED", "Host returned a thread outside the frozen scope");
    if (thread.emittedThreadStarted === true || thread.statusAfter === "running" && thread.statusBefore !== "running") {
      fail("SOURCE_READ_SIDE_EFFECT", "Read-only observation started or resumed the source thread");
    }
    const bounded = boundedItems(thread, this.#budget, this.#remainingText);
    this.#remainingText -= bounded.used;
    const turnIds = bounded.items.map((item) => item.locator.split(":item-")[0]);
    const range = {
      startTurnId: turnIds[0] ?? "none",
      endTurnId: turnIds.at(-1) ?? "none",
      itemIndexes: bounded.items.map((_, index) => index),
    };
    return immutableClone({
      schemaVersion: "source-envelope/1-alpha",
      projectId: this.#scope,
      threadId: member.id,
      nativeThreadId,
      range,
      observedAt,
      sourceUpdatedAt: thread.updatedAt ?? observedAt,
      contentDigest: fingerprint("source-envelope-content/1", bounded.items),
      redactionPolicy: "redaction/1-alpha",
      coverage: bounded.partial ? "partial" : "turn_indexed",
      items: bounded.items,
    });
  }
}

export class IndexRequestCoordinator {
  #active = new Map();
  #publishedScopes;

  constructor({ publishedScopes = new Set() } = {}) { this.#publishedScopes = publishedScopes; }

  request({ scopeId, triggerKind, requestOrigin, observationCutoff, run }) {
    const decision = authorizeIndexUpdate({
      trigger: triggerKind,
      projectId: scopeId,
      selectedProjectId: scopeId,
      hasPublishedRevision: this.#publishedScopes.has(scopeId),
      userInitiated: triggerKind === "explicit_refresh",
    });
    if (decision.decision !== "allow") fail(decision.code, "Index update is not authorized", { nextAction: decision.nextAction });
    const key = fingerprint("index-request/1", { scopeId, triggerKind, requestOrigin, observationCutoff });
    if (this.#active.has(key)) return this.#active.get(key);
    const promise = Promise.resolve().then(run).finally(() => this.#active.delete(key));
    this.#active.set(key, promise);
    return promise;
  }
}

export { DEFAULT_BUDGET };
