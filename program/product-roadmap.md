# LA Muni RAG — Product Roadmap

Updated: 2026-07-22T19:34:37Z

## Verified feature-branch capabilities

- Tenant identity/RBAC, forced RLS, artifact acceptance, ingestion, vector, catalog, Search, EvidenceBundle, ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase foundations.
- Closed integration registry: 30 schemas, 30 examples and OpenAPI 3.1.1.
- Portable provider-side contract kits for OS Electoral and Content Agency.
- Executable staging/E2E architecture: 2 synthetic tenants, 10 roles, 13 deterministic fixtures, 20 API/system journeys and 12 blocked browser journeys.
- Feature 071 public surface: direct Assistant/Glass Wall navigation, modular accessible assets, fail-closed Pages bridge, no static evidence fixtures and GCP target architecture.
- Disposable PostgreSQL/pgvector, compiled HTTP, accessibility and logical restore gates.

These are published feature-branch and CI artifacts. They are not merged or deployed production.

## Phase 1 — Public query gateway

1. Define a closed request/response contract for `POST /api/public/v1/query`.
2. Bind one approved public tenant/corpus server-side; accept no tenant, credential or authority claim from the browser.
3. Enforce exact CORS origin, method, content type, body limit, timeout and rate/abuse controls.
4. Reuse current public-only Search/EvidenceBundle eligibility without exposing internal IDs, credentials, object coordinates, scanner metadata or audit details.
5. Return bounded citations and explicit no-evidence/degraded states.
6. Add adversarial HTTP, PostgreSQL/RLS, replay/rate, compiled smoke and public-surface integration gates.

Exit criterion: the static product can query a safe public boundary without a browser service credential. This does not waive the real-corpus requirement.

## Phase 2 — Execute ephemeral staging

1. Implement the Feature 070 runner for preflight, fresh database creation, migrations, identity/fixture seeding, API/system journeys, sanitized receipts and destruction.
2. Ensure no production secret or data enters the environment.
3. Execute all twenty API/system journeys, including cross-tenant denial, permissions, idempotency, dependency failures, separation of duties and reset verification.
4. Preserve timing, diagnostics and cleanup evidence.

Exit criterion: the machine-readable staging plan executes end to end against isolated disposable services.

## Phase 3 — External consumer conformance

1. Pin immutable Feature 069 kit SHAs in OS Electoral and Content Agency.
2. Run schema/OpenAPI tests in each consumer repository.
3. Prove preservation of IDs, versions, citations, disclaimers, limits, expiry, retries and structured failures.
4. Exercise revocation and supersession across independent stores.

Exit criterion: both external repositories pass their own suites. This cannot be claimed from LA Muni RAG alone.

## Phase 4 — Authorized Antigua-first corpus

1. Approve source rights, durable storage, scanner, retention and provenance controls.
2. Acquire exact municipal and national artifacts with immutable manifests.
3. Execute scan, extraction, chunking, embeddings, ingestion and reconciliation.
4. Build judged keyword, phrase, semantic and hybrid datasets.
5. Complete human authority, vigencia, jurisdiction, applicability and contradiction review.

Exit criterion: real public evidence supports the gateway and tenant APIs with judged quality.

## Phase 5 — Guarded GCP infrastructure

1. Add Terraform modules with `allow_billable_resources = false` by default.
2. CI may format, validate and produce sanitized plans; automated `apply` remains forbidden.
3. After human project/billing/region/budget approval, provision staging identities, Artifact Registry, Cloud Run, Cloud SQL, Storage, queueing, secrets and telemetry.
4. Configure budget alerts, quotas, max instances, network boundaries and reviewed IAM.

Exit criterion: isolated staging exists with immutable receipts and no uncontrolled spend.

## Phase 6 — Human identity and authenticated SaaS

1. Approve IdP/OIDC/PKCE/BFF/session architecture.
2. Implement provisioning, secure cookies, CSRF, logout, revocation, recovery and access review.
3. Build role-aware source, document, search, workflow, case, review, admin and audit surfaces.
4. Bind human journeys to server-side authorization without exposing integration credentials.

## Phase 7 — Browser E2E and accessibility

1. Enable browser journeys only after identity, gateway, fixtures and deployed staging are stable.
2. Keep the suite bounded to critical user outcomes.
3. Run supported browsers, keyboard, screen readers and human WCAG review.
4. Test degraded/denial states without duplicating API-owned schema, RLS, persistence or retry tests.

## Phase 8 — Production operations and release

1. Exercise SLOs, alerts, load, capacity, HA, failover, object/database recovery, PITR and KMS recovery.
2. Complete retention, deletion, legal hold and DSAR operations.
3. Run security review, penetration testing and incident exercises.
4. Open reviewed PRs, merge through protection, rehearse deployment/rollback, roll out progressively and observe.
