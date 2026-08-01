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

Feature 089 functional commit `987ff78d1f7ae2ab59ce6d2658726b1bc14c5601` has green exact-SHA Backend CI runs `30683375100` and `30683368396` plus Public Browser Gate runs `30683375102` and `30683368414`.

The replay contains:

- 115 append-only events;
- ten nodes in `done` state;
- eight required gates with `PASS` results;
- four checkpoints;
- zero ready nodes.

Feature 089 adds nine official national discovery records, exact source-pack/inventory binding validation, category-neutral MARN routing and concrete evidence requirements for all 47 water-project categories. The new records remain verified only: zero new artifacts are represented as acquired, scanned, extracted, indexed or projected.

The graph checkpoint remains `PARTIAL_WITH_DOCUMENTED_BLOCKERS`, not `COMPLETED`: PR #33 and stacked draft PR #34 are unmerged; managed-corpus mutation and deployment require human authorization; the nine national sources require governed acquisition and applicability review; seven scanned municipal PDFs require approved OCR and human review; productive identity and broader operational controls remain outside this node.
