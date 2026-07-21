# Tasks — 062 EvidenceGapRequest Provider v1

## Specification and contracts

- [x] Define ownership and non-resolution boundary.
- [x] Close bounded request fields and response fields.
- [x] Add `requester_supplied_unverified` machine-readable labeling.
- [x] Add OpenAPI route, headers, auth and exact response/error set.
- [x] Add contract registry/example validation.

## Runtime and persistence

- [x] Implement auth-before-body and rate-before-validation flow.
- [x] Enforce `integration:query`, tenant and credential provenance.
- [x] Reject electoral/content work and authority promotion.
- [x] Implement exact transport replay and distinct-key aggregate replay.
- [x] Implement key and aggregate identity conflicts.
- [x] Implement canonical replay validation and corruption invalidation.
- [x] Add immutable tenant aggregate and dedicated replay/rate state.
- [x] Add response SHA-256 constraints, FORCE RLS and composite tenant FKs.
- [x] Add bounded pre-tenant auth failure aggregate.
- [x] Wire server route, health surface and configurable dependencies.

## Verification and review

- [x] Confirm RED phase for missing provider/migration/contract behavior.
- [x] Pass 11 focused provider behaviors.
- [x] Pass 3 migration/contract boundary checks.
- [x] Prove simultaneous same-key fencing.
- [x] Prove distinct-key aggregate convergence in memory and PostgreSQL.
- [x] Prove non-owner/NOSUPERUSER/NOBYPASSRLS execution.
- [x] Recreate the disposable DB and run the full shared provider sequence.
- [x] Pass ProcedureQuery, ClaimPack, lifecycle and EvidenceGap compiled smokes.
- [x] Pass 669-test global regression with zero failures.
- [x] Pass inventory, domain, Pages, dependency audit, typecheck and build.
- [x] Complete spec, decision, risk, traceability, API, security and eval docs.

## Publication and external gates

- [ ] Commit functional implementation.
- [ ] Verify detached checkout from the functional commit.
- [ ] Push `feature/evidence-gap-request-v1` and verify exact remote SHA.
- [ ] Verify Backend CI conclusion for the exact functional SHA.
- [ ] Create/update draft PR when an authorized PR action is available.
- [ ] Run OS Electoral consumer contract and retry/ID-preservation tests.
- [ ] Approve Privacy/Legal retention and immutable-resolution policy.
- [ ] Verify staging, observability, load/HA, backup/restore and deployment.
