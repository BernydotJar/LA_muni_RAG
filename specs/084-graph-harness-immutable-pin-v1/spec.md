# Feature 084 - Immutable Graph Harness runtime pin v1

## Goal

Replace the prior observed/uncommitted framework reference with an immutable published Graph Harness SDLC commit and prove that the existing event chain replays with that exact runtime.

## Requirements

- Pin `BernydotJar/Graph-harness-sdlc` to merge commit `1bebce3db35303072049233786464bb01163c98b`.
- Verify that the pinned commit contains executable runtime commit `fef364bc66849b98c08d3c1dcb91caf9701027cd`.
- Execute `validate`, `status`, and `ready` with the pinned package.
- Keep application runtime code out of this repository.
- Preserve all prior events, hashes, node revisions, gates, and checkpoints.

## Non-goals

- Redesigning Graph Harness SDLC.
- Copying framework source into LA Muni RAG.
- Granting merge, deployment, infrastructure, identity, corpus, or spending authority.

## Gate

The node is complete only after immutable install/replay evidence, independent review, regression, and exact-SHA remote CI pass.
