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

Functional retrieval commit `70ec287f1a8705637e04374ca2562fafa175e0da` has green exact-SHA Backend CI `30477447935`, Public Browser Gate `30477448607` and Terraform validation `30477447915`.

The replay contains:

- 82 append-only events;
- two localized repair plans;
- seven required gates with `PASS` results;
- eight nodes in `done` state;
- two checkpoints;
- zero ready nodes.

Feature 085 credits one exact clean PDM-OT document as ingested with 224 sections and 444 chunks. Feature 086 executes a frozen 12-case retrieval benchmark against that real corpus. Safety passes with zero unsupported answers and zero cross-document leakage, while phrase, keyword and hybrid ranking/top-1 citation quality gaps remain explicit.

The graph terminal state is `PARTIAL_WITH_DOCUMENTED_BLOCKERS`, not `COMPLETED`: no public HTTPS backend is deployed or connected to Pages, productive authenticated journeys remain `0/12`, DMP OCR and held-out corpus review remain open, and managed identity, infrastructure, protected merge and release require external human authorization.
