# LA Muni RAG — Product Roadmap

Updated: 2026-07-22T16:53:05Z

## Completed locally with explicit limitations

- Tenant identity/RBAC, forced RLS, artifact acceptance, ingestion, vector, catalog, Search, EvidenceBundle, ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle, and ProcedureCase foundations.
- Closed integration registry: 30 schemas, 30 examples, OpenAPI 3.1.1.
- Portable provider-side contract kits for OS Electoral and Content Agency.
- Feature 070 executable staging/E2E architecture: 2 synthetic tenants, exact 10-role matrix, 13 deterministic fixtures, 20 API/system journeys, 12 browser journeys blocked, deterministic reset, and strict mock/layer policies.
- Disposable PostgreSQL/pgvector, compiled HTTP, accessibility, and logical restore gates.

These are feature-branch and CI artifacts, not merged or deployed production.

## Phase 1 — Realize the ephemeral staging contract

1. Implement a local runner for preflight, fresh database creation, migrations, identity seeding, deterministic fixture seeding, API/system journeys, sanitized artifact collection, and destruction.
2. Ensure no production secrets or data enter the environment.
3. Exercise all twenty API/system journeys, including cross-tenant denial, permissions, idempotency, failures, separation of duties, and reset verification.
4. Preserve run receipts, timing, diagnostics, and cleanup evidence.

Exit criterion: the machine-readable Feature 070 plan is executed end to end against isolated disposable services.

## Phase 2 — External consumer conformance

1. Pin the exact Feature 069 contract-kit SHA in OS Electoral and Content Agency.
2. Run equivalent schema/OpenAPI tests in each consumer repository.
3. Prove preservation of IDs, versions, citations, disclaimers, limitations, expiry, retries, and structured failures.
4. Exercise revocation and supersession behavior across independent stores.

Exit criterion: both consumer repositories pass against an immutable kit SHA. This cannot be claimed from LA Muni RAG alone.

## Phase 3 — Authorized Antigua-first corpus

1. Approve source rights, durable storage, scanner, retention, and provenance controls.
2. Acquire exact municipal and national artifacts with immutable manifests.
3. Execute scan, extraction, chunking, embeddings, ingestion, and reconciliation.
4. Build judged keyword, phrase, semantic, and hybrid datasets with human authority/vigencia/applicability review.

## Phase 4 — Human identity and authenticated SaaS

1. Approve IdP/OIDC/PKCE/BFF/session architecture.
2. Implement provisioning, secure cookies, CSRF, logout, revocation, recovery, and access review.
3. Build role-aware source, document, search, workflow, case, review, admin, and audit surfaces.
4. Bind the twelve planned browser personas/journeys to server-side authorization without exposing service Bearer credentials.

## Phase 5 — Browser E2E and accessibility

1. Enable browser journeys only after identity, fixtures, deployed ephemeral services, and API/system journeys are stable.
2. Keep the suite bounded to the twelve critical human outcomes in Feature 070.
3. Run supported browsers, keyboard navigation, screen readers, and human WCAG 2.2 AA review.
4. Test degraded and denial states without duplicating API-owned schema, RLS, persistence, or retry tests.

## Phase 6 — Platform, operations, and release

1. Terraform environments, workload identity, secrets, production object store, scanner, dispatcher, and observability.
2. SLOs, alerts, staging, load, capacity, HA, failover, coordinated object/database recovery, PITR, and KMS recovery.
3. Privacy retention, deletion, legal hold, and DSAR operations.
4. Human-reviewed PRs, protected merge, deployment rehearsal, approvals, rollout, rollback, and observation.
