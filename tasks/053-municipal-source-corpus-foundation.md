# Feature 053 — Task Ledger

## Dependency

- [x] PR #17 full gates passed.
- [x] Human approval received.
- [x] PR #17 merged externally.
- [x] Reconciled base created from merge commit `ed2fa98427e2857956c0ed30b6a7813043ab1bfe`.

## Producer

- [x] Create feature branch.
- [x] Define source inventory contract and states.
- [x] Define authority and jurisdiction metadata.
- [x] Add strict record validator.
- [x] Add declarative manifest parser.
- [x] Add reconciliation with operational corpus manifest.
- [x] Add initial Antigua/national/Mixco inventory.
- [x] Add source inventory validation CLI.
- [x] Fix Antigua evidence boundary for national law.
- [x] Prevent named external municipalities from becoming primary via title heuristics.
- [x] Add deterministic and adversarial tests.
- [x] Add acquisition and ingestion runbook.

## Critic

- [ ] Verify no source is falsely marked acquired or ingested.
- [ ] Verify Mixco remains comparative.
- [ ] Verify national law does not set Antigua evidence.
- [ ] Verify unknown municipality cannot become primary.
- [ ] Verify duplicate/version/hash rules.
- [ ] Verify no War Room changes.
- [ ] Verify no database or corpus writes.

## Independent verifier

- [ ] `npm run source-inventory:validate`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] focused Feature 053 tests
- [ ] `npm run domain:evaluate`
- [ ] `npm run test`
- [ ] `npm run build:pages`
- [ ] `node scripts/verify-pages-artifact.mjs`
- [ ] `git diff --check`
- [ ] bounded `dist-pages/` cleanup
- [ ] clean generated state

## Release review

- [ ] Draft PR opened.
- [ ] CI evidence recorded.
- [ ] Scope and limitations documented.
- [ ] Human review requested.
- [ ] No automatic merge.
