#!/usr/bin/env node
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { fingerprint } from "../src/domain/hashing.mjs";
import { IndexingPipeline } from "../src/indexing-pipeline.mjs";
import { generateRelationCandidates } from "../src/inference.mjs";
import { GraphRegistry } from "../src/registry.mjs";

const budgets = Object.freeze({ enumeratedThreads: 100, deepReadThreads: 12, sourceCharacters: 120_000, elapsedMs: 2_000, heapDeltaBytes: 64 * 1024 * 1024 });

function benchmarkHost() {
  let projectId;
  let reads = 0;
  return {
    get reads() { return reads; },
    async listThreads({ projectId: scope }) {
      projectId = scope;
      return Array.from({ length: 100 }, (_, index) => ({ id: `native-${String(index).padStart(3, "0")}`, projectId, title: `Thread ${index}`, updatedAt: "2026-09-04T00:00:00.000Z", parentThreadId: index > 0 && index % 10 === 0 ? `native-${String(index - 10).padStart(3, "0")}` : null }));
    },
    async readThread({ threadId }) {
      reads += 1;
      return { id: threadId, projectId, updatedAt: "2026-09-04T00:00:00.000Z", statusBefore: "notLoaded", statusAfter: "notLoaded", emittedThreadStarted: false, turns: Array.from({ length: 8 }, (_, index) => ({ id: `${threadId}-turn-${index}`, status: "completed", items: [{ role: "user", type: "message", text: "x".repeat(2_500) }] })) };
    },
  };
}

function emptyExtraction(source) {
  return { schemaVersion: "extraction/1-alpha", sourceEnvelopeDigest: fingerprint("source-envelope/1", source), extractorVersion: "extractor/1-alpha", claims: [], aliases: [], relationCandidates: [], warnings: [] };
}

export async function benchmarkIndexing() {
  globalThis.gc?.();
  const registryPath = join(mkdtempSync(join(tmpdir(), "threadgraph-index-benchmark-")), "graph.db");
  const registry = new GraphRegistry(registryPath);
  const host = benchmarkHost();
  const pipeline = new IndexingPipeline({ registry, host, hostId: "benchmark-host", canonicalProjectId: "saved-project", canonicalProjectPath: "/benchmark/project", workerId: "benchmark-worker" });
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const prepared = await pipeline.prepare({ triggerKind: "initial_graph_open", requestOrigin: "benchmark", observationCutoff: "2026-09-04T01:00:00.000Z" });
  const sourceCharacters = prepared.sources.reduce((total, source) => total + source.items.reduce((sum, item) => sum + item.text.length, 0), 0);
  const published = await pipeline.publish({ sessionId: prepared.sessionId, extractions: prepared.sources.map(emptyExtraction) });
  const candidateBudget = generateRelationCandidates(Array.from({ length: 100 }, (_, index) => ({ id: `profile-${String(index).padStart(3, "0")}`, projectId: prepared.scopeId, topicIds: ["shared-topic"], activeDecisionIds: [], artifactIds: [], activeConstraintIds: [], referenceIds: [] })));
  const elapsedMs = performance.now() - started;
  const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
  const graph = published.graph;
  const measurements = {
    enumeratedThreads: prepared.sources.length + prepared.omittedSemanticSources,
    deepReadThreads: host.reads,
    semanticSources: prepared.sources.length,
    metadataOnlySources: prepared.omittedSemanticSources,
    sourceCharacters,
    modelInputTokens: null,
    modelOutputTokens: null,
    candidatePairs: candidateBudget.candidates.length,
    omittedCandidatePairs: candidateBudget.omittedCount,
    acceptedRelations: graph.relations.length,
    rejectedRelations: candidateBudget.candidates.length,
    reusedObservations: 0,
    invalidatedProjections: 0,
    publishedThreadNodes: graph.nodes.filter((node) => node.kind === "thread").length,
    elapsedMs: Math.round(elapsedMs * 1000) / 1000,
    heapDeltaBytes,
  };
  const failures = [];
  for (const name of ["enumeratedThreads", "deepReadThreads", "sourceCharacters"]) if (measurements[name] > budgets[name]) failures.push(name);
  for (const name of ["elapsedMs", "heapDeltaBytes"]) if (measurements[name] > budgets[name]) failures.push(name);
  if (measurements.enumeratedThreads !== measurements.publishedThreadNodes) failures.push("metadataCoverage");
  if (measurements.semanticSources + measurements.metadataOnlySources !== measurements.enumeratedThreads) failures.push("coverageAccounting");
  if (measurements.candidatePairs !== 1_000 || measurements.omittedCandidatePairs !== 3_950) failures.push("candidateBudget");
  const report = { schemaVersion: "index-budget-report/1", policyVersion: "index-policy/1-alpha", budgets, measurements, coverage: { state: measurements.metadataOnlySources > 0 ? "partial" : "complete", omittedSemanticSources: measurements.metadataOnlySources }, tokenAccounting: "unavailable", failures: [...new Set(failures)].sort(), passed: failures.length === 0 };
  registry.close();
  return report;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const report = await benchmarkIndexing();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}
