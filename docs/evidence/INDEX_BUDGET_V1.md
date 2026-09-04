# Initial indexing budget verification v1

## Purpose

Exercise every frozen `index-policy/1-alpha` resource ceiling in one reproducible local fixture and verify that budget exhaustion is explicit, bounded, and preserves metadata coverage.

## Fixture

- 100 enumerated project threads;
- 12 attempted deep reads;
- eight completed Turns per detailed thread;
- 2,500 source characters per Turn;
- 120,000 total source-character ceiling;
- 100 profiles sharing one semantic block, producing 4,950 possible relation pairs before the 1,000-pair ceiling;
- empty valid Extraction Envelopes so the benchmark measures the deterministic runtime rather than model latency.

Host model-token accounting was unavailable and is recorded as `null`; it is not estimated from characters.

## Observed result

Date: 2026-09-04. Bundled Node runtime on the local Codex macOS host.

| Measurement | Ceiling or expectation | Observed | Result |
| --- | ---: | ---: | --- |
| Enumerated threads | 100 | 100 | Pass |
| Deep-read attempts | 12 | 12 | Pass |
| Detailed source characters | 120,000 | 120,000 | Pass |
| Accepted candidate-pair budget | 1,000 | 1,000 | Pass |
| Explicitly omitted candidate pairs | 3,950 | 3,950 | Pass |
| Published thread nodes | all enumerated | 100 | Pass |
| Synthetic runtime target | ≤ 2,000 ms | 56.001 ms | Pass |
| Heap delta | ≤ 64 MiB | 10,498,360 bytes | Pass |

Six threads retained detailed semantic sources before the aggregate text ceiling was exhausted. The remaining 94 were published as metadata-only coverage. A detailed read that receives no remaining text is deliberately downgraded to a metadata observation rather than disappearing from the graph.

The graph published 109 exact relations. The separate saturated candidate fixture retained 1,000 pairs and reported 3,950 omitted pairs; it did not invent semantic acceptances.

## Decision

The provisional numeric ceilings are accepted for `index-policy/1-alpha`. They are safety ceilings, not completeness targets. Increasing them still requires a new policy version and before-and-after evidence.

Real installed indexing has independently exercised the 100-thread and 12-read shape. Live model-token accounting and raw-language extraction latency remain observable only in the final installed graph-open E2E.
