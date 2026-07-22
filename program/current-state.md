# LA Muni RAG — Current Program State

Updated: 2026-07-22T20:47:22Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 072 adds a verified public query gateway, but the gateway remains disabled and undeployed until an authorized real corpus, staging, edge controls and release approvals exist**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/public-query-gateway-v1
functional_commit: 856a6edee20cdb14a16a89d0d1a831faadbf166e
remote_functional_ref: 856a6edee20cdb14a16a89d0d1a831faadbf166e
pushed: true
remote_ci_run: 29955124279 success
PR_open: false
merged: false
staging_deployed: false
production_deployed: false
observed_in_production: false
cloud_resources_created: false
billable_actions: 0
```

`AGENTS.md` and `RTK.md` remain authoritative. Merge, deployment, paid infrastructure, project/billing creation, sensitive production credentials and legal conclusions remain human-gated.

## Feature 072 — public query gateway v1

`POST /api/public/v1/query` is implemented ahead of the production legacy-route gate. It:

- accepts only a closed `message`, `mode` and `limit` body;
- accepts only keyword or phrase anonymous retrieval;
- rejects browser Authorization and Cookie headers;
- binds tenant, jurisdiction and database role server-side;
- requires an exact reviewed Origin and minimal CORS headers;
- applies database-backed global and HMAC per-client rate buckets before retrieval;
- persists no raw IP, user-agent, query, excerpt or source URL in audit/rate state;
- uses forced RLS and the existing strict public evidence eligibility path;
- returns only bounded HTTPS citations without userinfo, query or fragment;
- never promotes comparative or validation-required evidence into a supported answer;
- returns explicit supported, insufficient-evidence or no-evidence states;
- remains disabled by default and does not configure Pages automatically.

Legacy `/api/chat` remains production-disabled. Browser service credentials remain prohibited.

## Verification

Exact detached checkout `856a6edee20cdb14a16a89d0d1a831faadbf166e`:

```text
EVAL-PUBLIC-QUERY-GATEWAY-001: 23/23 pass
full suite: 842 total / 840 pass / 0 fail / 2 explicit environment skips
canonical contracts: 33 schemas / 33 examples / OpenAPI 3.1.1
consumer contracts: 2 kits / 5 interactions / 0 issues
staging architecture: valid / 0 issues
typecheck: pass
build: pass
Pages fail-closed artifact: pass
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
PostgreSQL: 16.14
pgvector: 0.8.5
fresh migrations: 001–016
runtime role: non-owner / NOSUPERUSER / NOBYPASSRLS
forced RLS and cross-tenant denial: pass
compiled public gateway smoke: pass
Backend CI 29955124279: success
```

These gates prove the implementation boundary, not a deployed or legally authoritative service.

## Cumulative verified capabilities

- tenant identity/RBAC and transaction-local forced RLS;
- source/document/procedure catalog APIs;
- artifact acceptance, ingestion jobs, leases/fencing and tenant vectors;
- Search and conservative EvidenceBundle APIs;
- ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase APIs;
- provider-side consumer contract kits;
- executable staging/E2E architecture;
- fail-closed public product shell and Procedure Academy;
- dedicated public query gateway disabled by default;
- disposable PostgreSQL, compiled HTTP, accessibility and logical restore gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Synthetic fixtures and database gates do not change those values. Zero documents are credited as ingested against a real, reviewed corpus. The minimum Antigua-first and comparative corpus is incomplete.

## Next execution sequence

1. Execute the Feature 070 ephemeral staging runner and all twenty API/system journeys against disposable services.
2. Obtain authorization for Antigua-first corpus rights, durable storage, scanner, retention/legal-hold and named reviewers.
3. Acquire, scan, ingest and evaluate real public documents.
4. Add guarded GCP Terraform with `apply` disabled by default; create no resource before project, billing, region and budget approval.
5. Deploy isolated staging only after approval, then configure the public gateway and `PAGES_API_URL` with reviewed origins and edge controls.
6. Coordinate consumer-side suites in OS Electoral and Content Agency.
7. Approve and implement IdP/OIDC/PKCE/BFF/session and role-aware authenticated UI.
8. Complete browser E2E, human accessibility, load/HA, recovery/privacy, reviewed PR, protected merge, rollout and observation.

## Critical blockers

- `PQG-OPEN-ENABLEMENT-001`: gateway is implemented but cannot be enabled without authorized ingested public evidence, edge controls, staging and deployment approval;
- `BLK-CORPUS-OPS-001`: source rights, durable storage, scanner and retention/legal-hold controls are unavailable;
- zero real documents are credited as ingested and no judged real-corpus retrieval evidence exists;
- no staging runner has executed the twenty API/system journeys;
- browser authentication/session architecture and authenticated role-aware UI remain absent;
- external consumer repositories have not executed their suites;
- no GCP infrastructure, observability/SLO, load/HA, coordinated recovery or privacy operation exists;
- no reviewed PR, protected merge, deployment or observation window exists.

## Persistent boundary assertions

- Gateway implementation is not gateway enablement or deployment.
- GCP remains architecture only; zero resources and zero billable actions were created.
- EvidenceGap is intake-only; no research assignment, resolution lifecycle or notification workflow is implemented.
- There is no production object store, scanner/definitions monitor or dispatcher operating.
- Human IdP/BFF/session, access review and role-aware navigation remain unimplemented.
- Browser credentials are not integration credentials.
- Provider-side kits do not prove external interoperability.
- A green feature branch is not production readiness.
