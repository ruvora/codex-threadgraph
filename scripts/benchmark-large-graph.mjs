#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

import { buildGraphViewModel } from "../src/graph-service.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const budgets = Object.freeze({ fullViewMs: 250, filteredViewMs: 100, heapDeltaBytes: 64 * 1024 * 1024, serializedBytes: 5 * 1024 * 1024, uiResourceBytes: 100 * 1024 });
const relationKinds = ["belongs_to", "forked_from", "references", "related_to", "contradicts"];
const evidenceClasses = ["observed", "extracted", "inferred"];

function fixture(nodeCount, edgeCount) {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({ id: `node-${index}`, kind: index < 100 ? "thread" : "topic", nativeThreadId: index < 100 ? `native-${index}` : undefined, canonicalSubjectKey: index === 101 ? "private@example.com ghp_abcdefghijklmnop" : `subject-${index}`, lifecycle: "current" }));
  const relations = Array.from({ length: edgeCount }, (_, index) => {
    const evidenceClass = evidenceClasses[index % evidenceClasses.length];
    return { relationKey: `relation-${index}`, sourceId: nodes[index % nodeCount].id, targetId: nodes[(index * 17 + 1) % nodeCount].id, kind: relationKinds[index % relationKinds.length], evidenceClass, ...(evidenceClass === "inferred" ? { confidenceBand: "medium" } : {}) };
  });
  return { id: "large-graph", observationCutoff: "2026-09-04T00:00:00.000Z", nodes, relations };
}

export function benchmarkLargeGraph({ nodeCount = 5_000, edgeCount = 10_000 } = {}) {
  globalThis.gc?.();
  const revision = fixture(nodeCount, edgeCount);
  const heapBefore = process.memoryUsage().heapUsed;
  const fullStart = performance.now();
  const full = buildGraphViewModel(revision);
  const fullViewMs = performance.now() - fullStart;
  const filterStart = performance.now();
  const filtered = buildGraphViewModel(revision, { relationKinds: ["contradicts"], evidenceClasses: ["inferred"] });
  const filteredViewMs = performance.now() - filterStart;
  const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
  const serialized = JSON.stringify(full);
  const serializedBytes = Buffer.byteLength(serialized);
  const uiResourceBytes = Buffer.byteLength(readFileSync(join(here, "../ui/graph.html")));
  const privacy = {
    leakedEmail: serialized.includes("private@example.com"),
    leakedToken: serialized.includes("ghp_abcdefghijklmnop"),
    leakedNativeThreadIdentity: full.nodes.some((node) => Object.hasOwn(node, "nativeThreadId")),
    maximumLabelLength: Math.max(...full.nodes.map((node) => node.label.length), 0),
  };
  const measurements = { nodeCount, edgeCount, fullViewMs: Math.round(fullViewMs * 1000) / 1000, filteredViewMs: Math.round(filteredViewMs * 1000) / 1000, heapDeltaBytes, serializedBytes, uiResourceBytes, filteredNodes: filtered.nodes.length, filteredEdges: filtered.edges.length };
  const failures = [];
  for (const [name, budget] of Object.entries(budgets)) if (measurements[name] > budget) failures.push(name);
  if (privacy.leakedEmail || privacy.leakedToken || privacy.leakedNativeThreadIdentity || privacy.maximumLabelLength > 160) failures.push("privacy");
  return { schemaVersion: "large-graph-report/1", budgets, measurements, privacy, failures: [...new Set(failures)].sort(), passed: failures.length === 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = benchmarkLargeGraph();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}
