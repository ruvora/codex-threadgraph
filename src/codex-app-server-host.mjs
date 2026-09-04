import { spawn } from "node:child_process";
import readline from "node:readline";

const sourceKinds = ["cli", "vscode", "exec", "appServer", "subAgent", "subAgentReview", "subAgentCompact", "subAgentThreadSpawn", "subAgentOther", "unknown"];

function fail(code, message, details = {}) { const error = new Error(message); error.code = code; error.details = details; throw error; }
function canonicalTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value > 10_000_000_000 ? value : value * 1000).toISOString();
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}
function statusType(value) { return typeof value === "string" ? value : value?.type ?? "unknown"; }
function itemRole(item) {
  const type = String(item?.type ?? "").toLowerCase();
  if (type.includes("user")) return "user";
  if (type.includes("agent") || type.includes("assistant")) return "assistant";
  if (type.includes("system")) return "system";
  return "tool";
}
function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => typeof part === "string" ? part : part?.text ?? "").filter(Boolean).join("\n");
  return "";
}
export function normalizeCodexItem(item) {
  const text = [item?.text, textFromContent(item?.content), item?.message, item?.command, item?.output]
    .find((value) => typeof value === "string" && value.length > 0) ?? "";
  return {
    role: itemRole(item),
    type: String(item?.type ?? "unknown"),
    text: typeof text === "string" && text.length > 0 ? text : JSON.stringify(item ?? {}).slice(0, 10_000),
    ...(item?.exitCode !== undefined || item?.status !== undefined ? { terminalStatus: item.exitCode ?? item.status } : {}),
    ...(item?.path ? { artifactReference: String(item.path) } : {}),
  };
}

export class CodexAppServerHost {
  #codexPath;
  #projectPath;
  #child;
  #lines;
  #pending = new Map();
  #nextId = 1;
  #notifications = new Map();
  #listedStatus = new Map();
  #scopeId = null;
  #stderr = [];

  constructor({ codexPath, projectPath }) {
    if (typeof codexPath !== "string" || !codexPath || typeof projectPath !== "string" || !projectPath) fail("HOST_CONFIGURATION_INVALID", "Codex executable and canonical project path are required");
    this.#codexPath = codexPath;
    this.#projectPath = projectPath;
  }

  async #connect() {
    if (this.#child) return;
    this.#child = spawn(this.#codexPath, ["app-server", "--listen", "stdio://"], { cwd: this.#projectPath, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    this.#child.stderr.on("data", (chunk) => this.#stderr.push(chunk.toString()));
    await new Promise((resolve, reject) => {
      const onError = (error) => reject(Object.assign(new Error(`Unable to start the Codex App Server: ${error.message}`), { code: "HOST_START_FAILED", cause: error }));
      this.#child.once("error", onError);
      this.#child.once("spawn", () => { this.#child.off("error", onError); resolve(); });
    }).catch((error) => { this.#child = null; throw error; });
    this.#child.on("error", (error) => {
      for (const pending of this.#pending.values()) pending.reject(Object.assign(new Error(`Codex App Server transport failed: ${error.message}`), { code: "HOST_DISCONNECTED", cause: error }));
      this.#pending.clear();
    });
    this.#lines = readline.createInterface({ input: this.#child.stdout });
    this.#lines.on("line", (line) => this.#onLine(line));
    this.#child.once("exit", () => {
      for (const pending of this.#pending.values()) pending.reject(Object.assign(new Error("Codex App Server exited"), { code: "HOST_DISCONNECTED" }));
      this.#pending.clear();
    });
    await this.#request("initialize", { clientInfo: { name: "codex_threadgraph", title: "Codex ThreadGraph", version: "0.1.0" } });
    this.#send({ method: "initialized", params: {} });
  }

  #onLine(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id !== undefined && message.method === undefined) {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.#pending.delete(message.id);
      if (message.error) pending.reject(Object.assign(new Error(message.error.message), { code: "HOST_REQUEST_FAILED", details: message.error }));
      else pending.resolve(message.result);
      return;
    }
    if (message.method && message.id === undefined) this.#notifications.set(message.method, (this.#notifications.get(message.method) ?? 0) + 1);
    if (message.method && message.id !== undefined) this.#send({ id: message.id, error: { code: -32601, message: "Read-only adapter does not handle server requests" } });
  }

  #send(message) { this.#child.stdin.write(`${JSON.stringify(message)}\n`); }
  #request(method, params) {
    if (!["initialize", "thread/list", "thread/read"].includes(method)) fail("HOST_METHOD_DENIED", "Method is outside the read-only adapter", { method });
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(Object.assign(new Error(`Timed out waiting for ${method}`), { code: "HOST_TIMEOUT" })); }, 30_000);
      this.#pending.set(id, { resolve, reject, timer });
      this.#send({ id, method, params });
    });
  }

  async listThreads({ projectId, limit }) {
    await this.#connect();
    this.#scopeId = projectId;
    const result = await this.#request("thread/list", { cursor: null, limit, sortKey: "updated_at", sortDirection: "desc", sourceKinds, archived: false, cwd: [this.#projectPath] });
    const threads = result?.data ?? [];
    return threads.map((thread) => {
      this.#listedStatus.set(thread.id, statusType(thread.status));
      return {
        id: thread.id,
        projectId,
        title: thread.name ?? thread.preview ?? "",
        updatedAt: canonicalTimestamp(thread.updatedAt) ?? new Date().toISOString(),
        parentThreadId: thread.parentThreadId ?? thread.forkedFromId ?? null,
      };
    });
  }

  async readThread({ threadId }) {
    await this.#connect();
    if (!this.#scopeId) fail("HOST_SCOPE_NOT_LISTED", "Thread listing must establish scope before a read");
    const startedBefore = this.#notifications.get("thread/started") ?? 0;
    const result = await this.#request("thread/read", { threadId, includeTurns: true });
    const thread = result?.thread;
    if (!thread) fail("NOT_FOUND", "Codex thread was not found");
    const statusBefore = this.#listedStatus.get(threadId) ?? "unknown";
    const statusAfter = statusType(thread.status);
    return {
      id: thread.id,
      projectId: this.#scopeId,
      updatedAt: canonicalTimestamp(thread.updatedAt) ?? new Date().toISOString(),
      statusBefore,
      statusAfter,
      emittedThreadStarted: (this.#notifications.get("thread/started") ?? 0) > startedBefore,
      turns: (thread.turns ?? []).map((turn) => ({
        id: turn.id,
        status: statusType(turn.status) === "completed" || turn.completedAt ? "completed" : statusType(turn.status),
        items: (turn.items ?? []).map(normalizeCodexItem),
      })),
    };
  }

  async close() {
    this.#lines?.close();
    if (this.#child?.stdin.writable) this.#child.stdin.end();
    if (this.#child && this.#child.exitCode === null && this.#child.signalCode === null) this.#child.kill("SIGTERM");
    this.#child = null;
  }

  diagnostics() { return { notifications: [...this.#notifications.keys()].sort(), notificationCounts: Object.fromEntries(this.#notifications), stderr: this.#stderr.join("").trim() }; }
}
