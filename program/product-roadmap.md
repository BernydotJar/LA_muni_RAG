# LA Muni RAG — Product Roadmap

Updated: 2026-07-22T21:54:35Z

## Verified feature-branch capabilities

- Tenant identity/RBAC, forced RLS, artifact acceptance, ingestion, vector, catalog, Search, EvidenceBundle, ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase foundations.
- Closed integration registry: 33 schemas, 33 examples and OpenAPI 3.1.1.
- Portable provider-side contract kits for OS Electoral and Content Agency.
- Fail-closed public product shell and dedicated disabled-by-default public query gateway.
- Executed provider-side staging lifecycle: 20/20 API/system journeys, 12/12 browser blockers, four disposable databases, three runtime roles, sanitized receipt and zero residue.
- Disposable PostgreSQL/pgvector, compiled HTTP, accessibility and logical restore gates.

These are published feature-branch and CI artifacts. They are not merged or deployed.

## Phase 1 — Provider-side API/system staging — completed with limitations

Feature 073 executes the Feature 070 plan against a dedicated disposable PostgreSQL/pgvector service:

- exact 20/20 API/system journey mapping;
- exact viewer, manager, admin, integration, workflow and case personas;
- migrations, RLS gates and compiled smokes;
- reset-to-empty verification;
- clean-worktree immutable SHA receipt;
- 4/4 database and 3/3 role cleanup with zero-residue postcondition;
- named eval 14/14 and remote CI execution.

Residual limitation: synthetic provider-side staging is not cloud staging, browser E2E, external consumer execution or real-corpus evidence.

## Phase 2 — Authorized Antigua-first corpus — current priority

1. Approve source rights, durable storage, scanner, retention and provenance controls.
2. Acquire exact municipal and national artifacts with immutable manifests.
3. Execute scan, extraction, chunking, embeddings, ingestion and reconciliation.
4. Build judged keyword, phrase, semantic and hybrid datasets.
5. Complete human authority, vigencia, jurisdiction, applicability and contradiction review.

Exit criterion: real public evidence supports gateway and tenant APIs with judged quality.

## Phase 3 — Guarded GCP staging

1. Add Terraform modules with `allow_billable_resources = false` by default.
2. CI may format, validate and produce sanitized plans; automated `apply` remains forbidden.
3. After project/billing/region/budget approval, provision isolated staging identities, Artifact Registry, Cloud Run, Cloud SQL, Storage, queueing, secrets, Cloud Armor and telemetry.
4. Execute the same twenty journeys against immutable deployed revisions and real reviewed fixtures.
5. Configure budgets, quotas, max instances and reviewed IAM.

Exit criterion: isolated managed staging exists with immutable deployment and execution receipts.

## Phase 4 — External consumer conformance

1. Pin immutable provider kit SHAs in OS Electoral and Content Agency.
2. Run schema/OpenAPI tests in each repository.
3. Prove IDs, versions, citations, limits, expiry, retries and structured failures.
4. Exercise revocation and supersession across independent stores.

## Phase 5 — Human identity and authenticated SaaS

1. Approve IdP/OIDC/PKCE/BFF/session architecture.
2. Implement provisioning, secure cookies, CSRF, logout, revocation, recovery and access review.
3. Build role-aware source, document, search, workflow, case, review, admin and audit surfaces.
4. Bind human journeys to server authorization without integration credentials in browsers.

## Phase 6 — Browser E2E and accessibility

1. Enable the twelve blocked browser journeys only after identity, gateway, corpus and deployed staging are stable.
2. Keep the suite bounded to critical user outcomes.
3. Run supported browsers, keyboard, screen readers and human WCAG review.

## Phase 7 — Production operations and release

1. Exercise SLOs, alerts, load, capacity, HA, failover, database/object/KMS recovery and PITR.
2. Complete retention, deletion, legal hold and DSAR operations.
3. Run security review, penetration testing and incident exercises.
4. Open reviewed PRs, merge through protection, rehearse rollout/rollback, deploy progressively and observe.
