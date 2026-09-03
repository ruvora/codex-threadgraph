# Product direction

## Problem

As Codex use grows, users accumulate many threads whose useful context is difficult to compare or combine. Titles and recency do not reliably answer which thread understands a goal, which decision is current, or where two threads disagree.

## Product definition

RUVORA Codex ThreadGraph is a local, read-only knowledge layer that converts thread context into an evidence-backed relationship graph. It helps users understand the existing thread landscape, choose an appropriate thread, and identify useful specialization without becoming an execution authority.

## Core outcomes

1. Explain how threads are related.
2. Show the evidence behind each relationship.
3. Recommend threads for a goal without silently selecting authority.
4. Surface contradictions, supersession, and stale context.
5. Preserve navigation to the original Codex thread.

## Non-goals

- Running or orchestrating Agent work
- Granting filesystem, network, side-effect, or integration authority
- Automatically modifying, archiving, renaming, or deleting threads
- Treating semantic similarity as truth or authority
- Uploading private thread content to an external service by default
- Replacing Codex ThreadHub execution and completion contracts
