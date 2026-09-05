import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { benchmarkLargeGraph } from "../../scripts/benchmark-large-graph.mjs";

test("G11 large graph view meets latency, memory, payload, and privacy budgets", () => {
  const report = benchmarkLargeGraph();
  assert.deepEqual(report.failures, []);
  assert.equal(report.passed, true);
  assert.equal(report.measurements.nodeCount, 5_000);
  assert.equal(report.measurements.edgeCount, 10_000);
});

test("G11 embedded UI uses the MCP Apps bridge and bounded rendering", () => {
  const html = readFileSync(new URL("../../ui/graph.html", import.meta.url), "utf8");
  assert.match(html, /jsonrpc:"2\.0"/);
  assert.match(html, /ui\/initialize/);
  assert.match(html, /ui\/notifications\/tool-result/);
  assert.match(html, /tools\/call/);
  assert.match(html, /slice\(0,250\)/);
  assert.match(html, /slice\(0,500\)/);
  assert.match(html, /id="graph-canvas"/);
  assert.match(html, /aria-label="Filtered thread relationship map"/);
  assert.match(html, /id="selection-details"/);
  assert.match(html, /Select a node or relationship/);
  assert.match(html, /project membership only/);
  assert.match(html, /does not mean the conversations are similar/);
  assert.match(html, /Technical details/);
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new Function(script));
});
