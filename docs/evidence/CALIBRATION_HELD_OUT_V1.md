# Held-out calibration: corpus v1

## Purpose

Evaluate the frozen alpha extraction-boundary, normalization, inference, confidence, and selection policies against a sanitized evaluation-only corpus that is not used as implementation input.

The corpus contains explicit labels for policy-boundary facts. It evaluates whether validated Extraction Envelopes and Goal Query dimensions are handled safely and deterministically. It does not claim that an arbitrary model will extract those envelopes correctly from unconstrained prose; that interpretation remains part of the final live Codex graph-open E2E.

## Corpus

- Schema: `calibration-corpus/1`
- Identifier: `threadgraph-held-out-v1`
- Intended use: `evaluation_only`
- Sanitized: yes
- Inference cases: 21
- Selection cases: 10
- Authority cases: 8
- Normalization cases: 6
- English slice: 19
- Korean slice: 15
- Mixed-language slice: 11

The cases cover positive and negative contradiction, explicit and recency-only supersession, continuation authority, evidence closure, unresolved counter-evidence, clear and ambiguous selection, incomplete evidence, blocking conflicts, proposal/question/rejection authority, NFKC normalization, spacing, casing, and accepted aliases.

## Results

| Metric | Target | Observed | Result |
| --- | ---: | ---: | --- |
| High-band inferred-edge precision | ≥ 0.95 | 1.00 | Pass |
| Medium-band inferred-edge precision | ≥ 0.85 | 1.00 | Pass |
| Contradiction precision | ≥ 0.98 | 1.00 | Pass |
| Supersession precision | 1.00 | 1.00 | Pass |
| Active decision and constraint precision | ≥ 0.95 | 1.00 | Pass |
| Recommended outcome correctness | ≥ 0.90 | 1.00 | Pass |
| Unsafe recommendation rate with blocking conflict | 0 | 0 | Pass |
| Correct incomplete-evidence abstention | ≥ 0.95 | 1.00 | Pass |
| Canonical normalization accuracy | 1.00 | 1.00 | Pass |
| Deterministic replay mismatch | 0 | 0 | Pass |
| Inferred-edge recall, reported only | — | 1.00 | Reported |

Every language slice produced 1.00 policy-boundary accuracy. The result is reproducible with `npm run calibrate`; `npm run test:calibration` fails whenever a required group is absent or a promotion threshold is missed.

## Promotion decision

The deterministic G5 and G6 policy boundaries meet their initial held-out promotion targets. The corpus and report version remain immutable inputs to future before-and-after policy comparisons. A future policy change requires a new corpus-compatible report and cannot rewrite this evidence.

Raw-language model interpretation, large-scope operational measurements, and installed desktop discovery remain separate release gates.
