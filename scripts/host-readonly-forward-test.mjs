#!/usr/bin/env node

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import readline from "node:readline";

const codexPath = process.env.CODEX_BIN ?? "codex";
const projectPaths = process.argv.slice(2).map((value) => resolve(value));

if (projectPaths.length === 0) {
  process.stderr.write("Usage: host-readonly-forward-test.mjs <project-path> [project-path...]\n");
  process.exitCode = 2;
} else {
  await run();
}

async function run() {
  const child = spawn(codexPath, ["app-server", "--listen", "stdio://"], {
    cwd: projectPaths[0],
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  const notificationMethods = new Set();
  const stderr = [];
  let nextId = 1;

  child.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id !== undefined && message.method === undefined) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(`${request.method}: ${message.error.message}`));
      else request.resolve(message.result);
      return;
    }
    if (message.method && message.id === undefined) notificationMethods.add(message.method);
    if (message.method && message.id !== undefined) {
      send({ id: message.id, error: { code: -32601, message: "Read-only probe does not handle server requests" } });
    }
  });

  function send(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function request(method, params = {}) {
    const allowedMethods = new Set(["initialize", "thread/list", "thread/read"]);
    if (!allowedMethods.has(method)) throw new Error(`Method is outside the read-only probe: ${method}`);
    const id = nextId++;
    return new Promise((resolveRequest, rejectRequest) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectRequest(new Error(`Timed out waiting for ${method}`));
      }, 30_000);
      pending.set(id, { method, resolve: resolveRequest, reject: rejectRequest, timer });
      send({ method, id, params });
    });
  }

  try {
    await request("initialize", {
      clientInfo: {
        name: "codex_threadgraph_forward_test",
        title: "Codex ThreadGraph Forward Test",
        version: "0.1.0",
      },
    });
    send({ method: "initialized", params: {} });

    const listed = await request("thread/list", {
      cursor: null,
      limit: 25,
      sortKey: "updated_at",
      sortDirection: "desc",
      sourceKinds: [
        "cli",
        "vscode",
        "exec",
        "appServer",
        "subAgent",
        "subAgentReview",
        "subAgentCompact",
        "subAgentThreadSpawn",
        "subAgentOther",
        "unknown",
      ],
      archived: false,
      cwd: projectPaths,
    });

    const listedThread = listed.data?.[0] ?? null;
    if (!listedThread?.id) {
      throw new Error("No in-scope thread is available; thread/read was not tested");
    }
    const readResult = await request("thread/read", { threadId: listedThread.id, includeTurns: true });
    const readThread = readResult?.thread ?? null;
    if (!readThread) throw new Error("thread/read returned no thread");
    if (notificationMethods.has("thread/started")) {
      throw new Error("Read-only observation unexpectedly emitted thread/started");
    }

    process.stdout.write(`${JSON.stringify({
      result: "pass",
      listCount: listed.data?.length ?? 0,
      listEnvelopeKeys: Object.keys(listed).sort(),
      listThreadKeys: listedThread ? Object.keys(listedThread).sort() : [],
      listStatusTypes: [...new Set((listed.data ?? []).map((thread) => thread.status?.type).filter(Boolean))].sort(),
      hasNextCursor: Boolean(listed.nextCursor),
      readPerformed: Boolean(readThread),
      readThreadKeys: readThread ? Object.keys(readThread).sort() : [],
      readStatusType: readThread?.status?.type ?? null,
      turnCount: Array.isArray(readThread?.turns) ? readThread.turns.length : null,
      turnKeys: readThread?.turns?.[0] ? Object.keys(readThread.turns[0]).sort() : [],
      observedNotificationMethods: [...notificationMethods].sort(),
      emittedThreadStarted: notificationMethods.has("thread/started"),
    }, null, 2)}\n`);
  } catch (error) {
    const detail = stderr.join("").trim();
    process.stderr.write(`${error.message}${detail ? `\n${detail}` : ""}\n`);
    process.exitCode = 1;
  } finally {
    lines.close();
    if (child.stdin.writable) child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
}
