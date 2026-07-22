# LA Muni RAG — Product Roadmap

Updated: 2026-07-22T00:35:00Z

## Completed locally with explicit limitations

- Tenant identity/RBAC and transaction-local RLS foundations.
- Artifact acceptance, ingestion jobs, leases/fencing and tenant vector foundations.
- ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase APIs.
- Governed Source/Document catalog API v1 (Feature 067).
- Dedicated Search and EvidenceBundle API v1 (Feature 068, functional commit `42d2fda`).
- Closed contract registry: 30 schemas, 30 examples and OpenAPI 3.1.1.
- Disposable PostgreSQL/pgvector, compiled HTTP and logical restore gates.

## Phase 1 — Authorized Antigua-first corpus

1. Approve source rights, storage, scanner, retention and provenance controls.
2. Acquire exact municipal/national artifacts into durable storage with immutable manifests.
3. Execute current scan, extraction, chunking, embeddings and ingestion reconciliation.
4. Preserve failures, dead letters and operator remediation evidence.

Exit criterion: real artifacts, digests, accepted scans, processed jobs and indexed chunks are traceable without counting fixtures.

## Phase 2 — Real-corpus retrieval and human review

1. Build judged keyword, phrase, semantic and hybrid datasets.
2. Measure relevance, citation accuracy, authority, temporal classification, contradictions, latency and cost.
3. Conduct human review of vigencia, supersession, jurisdiction and applicability.
4. Establish model/provider lifecycle, thresholds, regression policy and monitoring.

Exit criterion: approved eval thresholds and human-reviewed evidence on the target corpus.

## Phase 3 — Human SaaS

1. Decide and implement IdP/OIDC/BFF/session architecture.
2. Add tenant/member provisioning, recovery, revocation, secure cookies and CSRF.
3. Build role-aware source viewer, library, search, cases, reviews, admin and audit surfaces.
4. Complete browser, screen-reader and WCAG 2.2 AA testing.

## Phase 4 — Platform and operations

1. Terraform environments, workload identity, secrets, object store, scanner and dispatcher.
2. Observability, SLOs, alerts, staging, load, capacity and HA.
3. Coordinated recovery, PITR, KMS/key recovery, privacy retention/deletion/legal hold/DSAR.

## Phase 5 — Integration and release

1. Run external consumer contract suites.
2. Open reviewed PRs and use protected merge.
3. Deploy to staging, execute release rehearsal and approvals.
4. Deploy and observe production before declaring readiness.
