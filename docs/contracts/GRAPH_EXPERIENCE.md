# Graph experience contract

## Default view

The first view answers three questions:

1. Which threads are relevant to this project or goal?
2. Why are they related?
3. Which thread should the user inspect next?

It does not default to an unfiltered visualization of every known node.

## Visual semantics

- exact, extracted, and inferred edges have distinct visual treatments;
- stale, conflicted, unreadable, and superseded data are visible states, not hidden filters;
- confidence is shown only for inferred edges;
- relation direction and type remain readable without relying only on color;
- clusters are derived views and do not replace individual evidence paths.

## Evidence inspection

Selecting a node or edge opens an evidence panel containing source thread, bounded source reference, observation time, evidence class, extractor or inference version, currentness, and explanation. Private source text is summarized unless the user explicitly requests the bounded excerpt.

## Thread selection

A selection view shows candidates side by side across ranking dimensions. `ambiguous`, `no_suitable_candidate`, and `incomplete` are first-class results. The UI must not highlight an inferred winner as confirmed authority.

## Actions

Version 0.1 permits only:

- change graph filters;
- issue a read-only Goal Query;
- inspect evidence;
- navigate to a native thread;
- export an explicitly selected Context Pack when implemented.

Execution, archive, rename, role mutation, persistent specialization acceptance, and ThreadHub dispatch require separately contracted capabilities and are absent from the initial UI.

## Empty and failure states

The view distinguishes no threads in scope, no indexed evidence, no relationships, unreadable sources, indexing in progress, indexing failed, and a genuinely empty query result. Each state provides a read-only next action.
