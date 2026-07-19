# Feature 054 — Task Ledger

## Dependency

- [x] Feature 053 approved and merged externally.
- [x] Base created from merge commit `aa979ddd3bfb1aa3f0a35f5a3a9b2c91482b52a7`.
- [x] Feature branch created.
- [x] Issue #20 opened.

## Producer

- [x] Define import and ingestion contracts.
- [x] Add raw-byte SHA-256 hashing.
- [x] Add bounded deterministic library paths.
- [x] Add dry-run semantics.
- [x] Add idempotent import and ingestion.
- [x] Add version/hash conflict rejection.
- [x] Reuse existing extraction and vector indexing boundaries.
- [x] Reconcile inventory and operational manifests.
- [x] Add operator CLI.
- [x] Add runbook.

## Critic

- [x] Verify binary artifacts are hashed as bytes.
- [x] Verify dry-run performs no writes or indexing.
- [x] Verify failed indexing cannot mark inventory ingested.
- [x] Verify same version/different hash fails closed.
- [x] Verify authority metadata maps through Feature 053 safeguards.
- [ ] Inspect CI results and correct all failures.
- [ ] Verify no network acquisition or out-of-scope changes.

## Independent verifier

- [ ] `npm run source-inventory:validate`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] focused document-library tests
- [ ] `npm run domain:evaluate`
- [ ] `npm run test`
- [ ] `npm run build:pages`
- [ ] `node scripts/verify-pages-artifact.mjs`
- [ ] `git diff --check`
- [ ] bounded generated-artifact cleanup
- [ ] clean generated state

## Release review

- [ ] Draft PR opened.
- [ ] Final head CI evidence recorded.
- [ ] Scope audit completed.
- [ ] Human review requested.
- [ ] No automatic merge.
