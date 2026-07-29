# Graph Harness SDLC execution projection

This directory is an application-specific projection consumed by the Graph Harness SDLC runtime. It does not copy or reimplement framework runtime concepts.

## Runtime source

- Framework repository: `BernydotJar/Graph-harness-sdlc`
- Immutable published pin: `1bebce3db35303072049233786464bb01163c98b`
- Executable runtime commit contained by that merge: `fef364bc66849b98c08d3c1dcb91caf9701027cd`
- Verification command: `npm run graph-harness:verify`

Backend CI installs the framework package directly from the immutable published pin, executes `validate`, `status`, and `ready` over this application projection, and rejects a copied application-local `graph_harness` runtime directory. The framework remains the execution runtime; this repository stores only its application-specific project, event ledger, typed state, and evidence.

## Application sources of truth

The canonical application task and evidence records remain:

- `program/task-graph.yaml`
- `program/task-ledger.yaml`
- `program/evidence-register.jsonl`
- `program/eval-results.json`
- `program/current-state.md`

`project.json` is a bounded projection of the repair subgraph, not a replacement for those records. `events.jsonl` is the append-only execution history. `state.json` is the deterministic typed-state replay of that history.

## Localized repair scope

Exact-SHA CI for `ba6acf3cc654e798f46b104d4eaac6d5c78712ab` exposed two localized failures:

- WebKit root-level overflow at a 320-pixel viewport in Public Browser Gate run `30424332072`;
- local reliability shell p95 polluted by cold-start samples in Backend CI run `30424332058`.

The repair projection invalidated only:

- `WS11-HUMAN-SESSION-RELIABILITY-001`;
- `WS11-HUMAN-SHELL-ACCESSIBILITY-001`;
- their shared descendant `WS09-HUMAN-WORKSPACE-001`;
- the draft PR exact-SHA checkpoint.

`WS07-HUMAN-OIDC-PROVIDER-001` was independent and remained preserved.

## Verified closure

Functional repair `82d75711f28a03de4e7df35d5ec6435cc7610319` was published by audited non-forced fast-forward. Exact-SHA Backend CI run `30428162887`, Public Browser Gate run `30428162850`, and Terraform validation run `30428162725` all succeeded.

The final replay contains:

- 43 append-only events;
- two localized repair plans;
- four required gates with `PASS` results;
- five nodes in `done` state;
- one exact-SHA checkpoint.

The persisted hashes are:

- `events.jsonl`: `bd2e875076a9f916f1e88121f5a9e8b7dabaf2ab97127527240a7f931eda8d23`;
- `state.json`: `bcb28538df8997f7c0ee02fb3ec4a09ca6720d59d095d02376d8571468da8ece`.

This closure does not change product truth: productive identity remains unselected, productive browser journeys remain `0/12`, real documents credited as ingested remain `0`, and no production infrastructure, corpus, merge, or deployment operation is authorized.
