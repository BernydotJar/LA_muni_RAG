# LA Muni RAG — Product Roadmap

Updated: 2026-07-21T21:53:16Z

## Outcome

Deliver a production-operated Municipal Procedural Intelligence Platform that
turns governed sources into cited procedures, approved workflows and auditable
procedure cases without unsupported legal or institutional claims.

## Current foundation — implemented and verified on feature branches

- tenant/RBAC foundation and forced PostgreSQL RLS;
- exact artifact acceptance, durable jobs, leases/fencing and tenant vectors;
- ProcedureQuery outputs: EvidenceBundle, ProcedureWorkflow and conservative
  ProcedureAssessment;
- workflow draft/review/approval/read lifecycle;
- EvidenceGap and ClaimPack providers;
- tenant ProcedureCase create/read/update lifecycle;
- public evidence-first Procedure Academy;
- disposable logical database restore drill;
- all nineteen required named hard-eval families;
- governed source/document catalogs, safe ingestion-job monitoring and procedure list.

These capabilities are not merged/deployed and do not establish production readiness.

## Critical path to production

### Phase A — Complete the minimum product API

1. source catalog create/list — verified with limits at Feature 067;
2. document registration/library create/list — verified with limits at Feature 067;
3. ingestion-job list/monitor — verified with limits at Feature 067;
4. procedure catalog list — verified with limits at Feature 067;
5. dedicated retrieval search — ready;
6. dedicated EvidenceBundle endpoint — ready;
7. preserve OpenAPI/contracts, tenant RBAC, audit, rate limits, pagination,
   idempotency and PostgreSQL runtime gates for both remaining endpoints.

### Phase B — Acquire and validate a useful Antigua-first corpus

1. authorize durable object storage;
2. acquire exact official Antigua/national artifacts;
3. calculate hashes and retain provenance/version/effective-date evidence;
4. execute current malware scan and structural validation;
5. extract, chunk, embed and reconcile operational manifests;
6. human source/jurisdiction/applicability review;
7. evaluate keyword/phrase/semantic/hybrid retrieval and citation fidelity.

### Phase C — Authenticated SaaS product

1. approve human IdP, tenancy/provisioning and session/BFF architecture;
2. implement login/logout/revocation/recovery, CSRF and secure cookies;
3. authenticated source, document, ingestion, evidence, workflow, case, gap,
   admin/RBAC and audit surfaces;
4. server-side training/case state and role-aware navigation;
5. browser E2E, screen readers and human WCAG 2.2 AA review.

### Phase D — Production platform and operations

1. Terraform/environment provisioning and workload identity;
2. production object store/scanner/dispatcher/secrets;
3. structured logs, metrics, traces, SLOs and exercised alerts;
4. staging, capacity, load and HA verification;
5. coordinated database/object backup and restore, PITR, KMS/key recovery and
   approved RPO/RTO;
6. privacy retention/deletion/legal-hold/DSAR operations;
7. cross-repository consumer contract tests;
8. human legal, privacy, security and release approval;
9. protected merge and production deployment.

## Release milestones

| Milestone | Exit condition | State |
|---|---|---|
| M1 Production-shaped backend foundation | core providers, cases, DB gates, required evals | achieved on cumulative feature branches |
| M2 Minimum catalog API | all goal-minimum endpoints contract/runtime proven | partial: catalogs complete; Search/EvidenceBundle ready |
| M3 Real Antigua evidence path | durable corpus ingested and retrieval/citations human evaluated | blocked by storage/data/human review |
| M4 Authenticated SaaS beta | human identity plus role-aware accessible product surfaces | blocked by IdP/session decisions |
| M5 Production candidate | staging, telemetry, load/HA, coordinated recovery, no critical/high findings | not started |
| M6 Production release | protected merge, legal/privacy/security/release approvals and observed deployment | human-gated |
