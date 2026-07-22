# LA Muni RAG — Product Roadmap

Updated: 2026-07-22T01:05:41Z

## Completed locally with explicit limitations

- Tenant identity/RBAC and transaction-local RLS foundations.
- Artifact acceptance, ingestion jobs, leases/fencing and tenant vectors.
- Catalog, Search, EvidenceBundle, ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase APIs.
- Closed registry: 30 schemas, 30 examples and OpenAPI 3.1.1.
- Portable provider-side contract kits: 2 consumers / 5 interactions at `5e5481e`.
- Disposable PostgreSQL/pgvector, compiled HTTP, accessibility and restore gates.

These capabilities are feature-branch evidence, not merged/deployed production.

## Phase 1 — External consumer conformance

1. Pin the exact Feature 069 SHA in OS Electoral and Content Agency.
2. Run equivalent schema/OpenAPI tests in each consumer repository.
3. Prove preservation of tenant/request IDs, versions, citations, disclaimers, limitations, expiry and idempotency behavior.
4. Exercise retries, supersession/revocation and structured failures.

Exit criterion: both external consumer suites pass against an immutable kit SHA.

## Phase 2 — Authorized Antigua-first corpus

1. Approve source rights, storage, scanner, retention and provenance controls.
2. Acquire exact municipal/national artifacts with immutable manifests.
3. Execute current scan, extraction, chunking, embeddings and ingestion.
4. Preserve failures, dead letters and operator remediation evidence.

## Phase 3 — Identity and ephemeral staging

1. Approve human IdP/OIDC/PKCE/BFF/session architecture.
2. Implement provisioning, secure cookies, CSRF, logout, revocation and recovery.
3. Define resettable tenant identities and deterministic non-production fixtures.
4. Deploy immutable services to isolated ephemeral infrastructure without production credentials.

## Phase 4 — System/API journeys

1. Test auth, tenant isolation, replay, conflict, expiry and failure/retry paths.
2. Test cross-product preservation through real HTTP and independent stores.
3. Exercise observability, SLOs, load, HA and coordinated recovery.
4. Complete privacy retention/deletion/legal-hold/DSAR operations.

## Phase 5 — E2E and accessibility

1. Add a small browser smoke suite for critical user journeys.
2. Add role/permission matrices and degraded/failure journeys.
3. Run supported browsers, screen readers and human WCAG 2.2 AA review.
4. Keep E2E last: contracts, identity, fixtures and staging must be stable first.

## Phase 6 — Release

1. Run external consumers and all lower-layer gates on the candidate SHA.
2. Open human-reviewed PRs and use protected merge.
3. Rehearse deployment/rollback in staging and collect approvals.
4. Deploy and observe before declaring production readiness.
