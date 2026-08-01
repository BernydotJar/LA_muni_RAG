# Graph Harness SDLC execution projection

This directory is the application-specific execution projection consumed by the published Graph Harness SDLC runtime. The framework is the execution engine; this repository stores the project contract, append-only event ledger, deterministic typed state and evidence references.

## Runtime source

- Framework repository: `BernydotJar/Graph-harness-sdlc`
- Immutable published pin: `1bebce3db35303072049233786464bb01163c98b`
- Executable runtime contained by that merge: `fef364bc66849b98c08d3c1dcb91caf9701027cd`
- Verification command: `npm run graph-harness:verify`

Backend CI installs the framework package directly from the immutable Git commit, executes `validate`, `status` and `ready`, and rejects copied application-local framework source.

## Application sources of truth

- `program/task-graph.yaml`
- `program/task-ledger.yaml`
- `program/evidence-register.jsonl`
- `program/eval-results.json`
- `program/current-state.md`

`project.json` is a bounded executable projection. `events.jsonl` is append-only. `state.json` is regenerated deterministically from the project and event chain.

## Current terminal checkpoint

Feature 090 functional commit `79407c48361827afb94d9fa48adb8dd758c258e5` has green Backend CI runs `30684910546` and `30684905382` plus Public Browser Gate runs `30684910562` and `30684905372` on the exact SHA. Draft PR #35 is stacked on draft PR #34 and open PR #33.

The replay contains:

- 131 append-only events;
- eleven nodes in `done` state;
- ten required gates with `PASS` results;
- six checkpoints;
- three historical localized repair plans;
- zero ready nodes.

Feature 090 attempted 16 official HTML sources, accepted 11 exact clean snapshots totaling 1,833,794 bytes, and left five explicit blockers. Accepted records stop at `ingestion_pending`; zero new sources are indexed or projected. Raw artifacts remain outside Git.

The graph terminal state is `PARTIAL_WITH_DOCUMENTED_BLOCKERS`, not `COMPLETED`: PRs #33–#35 remain unmerged; indexing and managed-corpus mutation require human authorization and applicability review; five official endpoints do not currently provide safe substantive controlled bytes; seven scanned municipal PDFs require approved OCR and human review; productive identity, complete browser workflows and broader operational controls remain open. Merge and deployment are not authorized.
