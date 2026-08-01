# Feature 090 tasks

## Recovery and graph

- [x] Select the next safe successor after Feature 089 reached done.
- [x] Probe all 16 governed national HTML bindings without changing inventory.
- [x] Add and approve the Graph Harness node and release gate.

## Producer

- [x] Add acquisition plan configuration.
- [x] Implement exact-host, public-DNS and redirect validation.
- [x] Implement bounded HTML fetch and immutable content-addressed storage.
- [x] Add declared legacy-charset structural inspection and extraction.
- [x] Require complete real ClamAV evidence.
- [x] Update only successful inventory records to ingestion_pending.
- [x] Preserve blocked sources at verified with receipt failure codes.
- [x] Add deterministic positive and negative tests.
- [x] Execute the live 16-source acquisition plan.

## Critic / Red Team

- [x] Execute network, content, scanner, path, extraction and state-promotion attacks.
- [x] Persist findings and repairs.

## Independent verifier

- [ ] Commit the functional implementation and live receipt.
- [ ] Verify exact functional commit from a clean detached worktree.
- [ ] Reconcile every acquired byte against inventory and receipt.
- [ ] Run full tests, typecheck, build, audit and configuration gates.

## Publication and release gate

- [ ] Push and create a stacked draft PR.
- [ ] Confirm exact-head remote CI.
- [ ] Record all six evidence kinds.
- [ ] Evaluate the blocking gate and transition to done or document blockers.
- [ ] Record terminal checkpoint and remaining human gates.
