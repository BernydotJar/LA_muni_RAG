# LA Muni RAG — Product Roadmap

Updated: 2026-07-22T20:47:22Z

## Verified feature-branch capabilities

- Tenant identity/RBAC, forced RLS, artifact acceptance, ingestion, vector, catalog, Search, EvidenceBundle, ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase foundations.
- Closed integration registry: 33 schemas, 33 examples and OpenAPI 3.1.1.
- Portable provider-side contract kits for OS Electoral and Content Agency.
- Executable staging/E2E architecture: 2 synthetic tenants, 10 roles, 13 deterministic fixtures, 20 API/system journeys and 12 blocked browser journeys.
- Fail-closed public product shell with direct Assistant and Glass Wall navigation.
- Dedicated `/api/public/v1/query` gateway with server-bound tenant, exact origins, HMAC/global rate controls, public-only retrieval and minimized audit.
- Disposable PostgreSQL/pgvector, compiled HTTP, accessibility and logical restore gates.

These are published feature-branch and CI artifacts. They are not merged or deployed.

## Phase 1 — Public query gateway — completed with limitations

Feature 072 satisfies the implementation contract:

- no browser tenant, credential, Authorization or Cookie input;
- keyword/phrase-only anonymous retrieval;
- server-bound public tenant and jurisdiction;
- exact CORS, body/schema controls and bounded responses;
- forced-RLS public evidence eligibility;
- comparative evidence never promoted;
- HMAC/global rate buckets and minimized audit;
- 23/23 eval, fresh PostgreSQL 001–016 and compiled smoke.

Exit remaining: authorized real corpus, edge controls, staging, load/SLO, deployment approval and Pages binding.

## Phase 2 — Execute ephemeral staging — current priority

1. Implement the Feature 070 runner for preflight, fresh database creation, migrations, identity/fixture seeding, API/system journeys, sanitized receipts and destruction.
2. Ensure no production secret or data enters the environment.
3. Execute all twenty API/system journeys, including cross-tenant denial, permissions, idempotency, dependency failures, separation of duties and reset verification.
4. Preserve timing, diagnostics and cleanup evidence.

Exit criterion: the machine-readable staging plan executes end to end against isolated disposable services.

## Phase 3 — Authorized Antigua-first corpus

1. Approve source rights, durable storage, scanner, retention and provenance controls.
2. Acquire exact municipal and national artifacts with immutable manifests.
3. Execute scan, extraction, chunking, embeddings, ingestion and reconciliation.
4. Build judged keyword, phrase, semantic and hybrid datasets.
5. Complete human authority, vigencia, jurisdiction, applicability and contradiction review.

Exit criterion: real public evidence supports the gateway and tenant APIs with judged quality.

## Phase 4 — Guarded GCP staging

1. Add Terraform modules with `allow_billable_resources = false` by default.
2. CI may format, validate and produce sanitized plans; automated `apply` remains forbidden.
3. After project/billing/region/budget approval, provision isolated staging identities, Artifact Registry, Cloud Run, Cloud SQL, Storage, queueing, secrets, Cloud Armor and telemetry.
4. Configure budgets, quotas, max instances and reviewed IAM.

Exit criterion: isolated staging exists with immutable receipts and controlled spend.

## Phase 5 — External consumer conformance

1. Pin immutable provider kit SHAs in OS Electoral and Content Agency.
2. Run schema/OpenAPI tests in each repository.
3. Prove IDs, versions, citations, limits, expiry, retries and structured failures.
4. Exercise revocation and supersession across independent stores.

## Phase 6 — Human identity and authenticated SaaS

1. Approve IdP/OIDC/PKCE/BFF/session architecture.
2. Implement provisioning, secure cookies, CSRF, logout, revocation, recovery and access review.
3. Build role-aware source, document, search, workflow, case, review, admin and audit surfaces.
4. Bind human journeys to server authorization without integration credentials in browsers.

## Phase 7 — Browser E2E and accessibility

1. Enable browser journeys only after identity, gateway, corpus and deployed staging are stable.
2. Keep the suite bounded to critical user outcomes.
3. Run supported browsers, keyboard, screen readers and human WCAG review.

## Phase 8 — Production operations and release

1. Exercise SLOs, alerts, load, capacity, HA, failover, database/object/KMS recovery and PITR.
2. Complete retention, deletion, legal hold and DSAR operations.
3. Run security review, penetration testing and incident exercises.
4. Open reviewed PRs, merge through protection, rehearse rollout/rollback, deploy progressively and observe.
