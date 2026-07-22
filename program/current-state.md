# LA Muni RAG — Current Program State

Updated: 2026-07-22T19:34:37Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 071 converts the public surface into an honest product shell; the public query gateway, real corpus, human identity, cloud infrastructure and production release remain open**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/production-public-surface-v1
functional_commit: bf29e6fdc48fa155b004b5f0b2ff410050b59c84
remote_functional_ref: bf29e6fdc48fa155b004b5f0b2ff410050b59c84
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
pushed: true
remote_ci_run: 29951023165 success
PR_open: false
merged: false
staging_deployed: false
production_deployed: false
observed_in_production: false
cloud_resources_created: false
billable_actions: 0
```

`AGENTS.md` and `RTK.md` remain authoritative. Protected merge, production deployment, paid infrastructure, project/billing creation, sensitive credentials, legal conclusions and modifications to neighboring products remain human-gated.

## Feature 071 — production-facing public surface

The public product now has:

- direct primary navigation to **Assistant** and **Glass Wall**;
- Academy and installation as secondary destinations;
- a concise product hero and installation section;
- no “Experiencia con evidencia”, “Flujo visual” or “Sistema operable” marketing sections;
- modular `product.css` and `product.js` assets;
- cyan reserved for interaction, visible keyboard focus, reduced-motion support and responsive stacking;
- measured contrast above 4.5:1 for tested normal, muted, quiet, CTA and panel token combinations;
- a fail-closed Pages bridge with no static answers, citations, procedures or domain fixtures;
- a widget that disables query controls when no API is configured;
- no claims that documents are verified, official, current or loaded unless supplied by a real backend response;
- default browser route `/api/public/v1/query`, not legacy `/api/chat`.

The production server intentionally returns 404 for both legacy `/api/chat` and the not-yet-implemented `/api/public/v1/query`. This is a safety boundary, not a missing configuration workaround. An integration Bearer credential must never be placed in Pages or browser storage.

## Cloud target

Decision 071 selects Google Cloud as architecture only:

```text
Cloud Run: public gateway, authenticated API and reviewed jobs/workers
Cloud SQL: PostgreSQL plus pgvector
Cloud Storage: immutable document objects
Pub/Sub or Cloud Tasks: asynchronous work
Secret Manager: workload-scoped secrets
Artifact Registry: immutable images
Cloud Logging and Monitoring: sanitized telemetry and SLO evidence
```

No GCP project, billing account, Terraform apply, Cloud Run service, Cloud SQL instance, bucket, queue, secret, DNS record or paid model was created. Region, budget, project ownership and production topology remain human decisions.

## Verification

Exact detached checkout `bf29e6fdc48fa155b004b5f0b2ff410050b59c84`:

```text
EVAL-PRODUCTION-PUBLIC-SURFACE-001: 33/33 pass
full suite: 818 total / 816 pass / 0 fail / 2 explicit environment skips
canonical contracts: 30 schemas / 30 examples / OpenAPI 3.1.1
consumer contracts: 2 kits / 5 interactions / 0 issues
staging architecture: valid / 0 issues
typecheck: pass
build: pass
source inventory: 17 valid / 4 verified / 1 acquisition metadata / 0 ingested
domain evaluation: 8/8
Pages fail-closed artifact: pass
browser smoke: desktop/mobile screenshots plus DOM markers pass
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
Backend CI 29951023165: success
```

A green public shell and cloud blueprint are not a gateway, corpus, staging environment, reviewed PR, protected merge or production deployment.

## Cumulative verified capabilities

- tenant identity/RBAC and transaction-local forced-RLS foundations;
- governed source, document and procedure catalog APIs;
- artifact acceptance, ingestion jobs, leases/fencing and tenant-vector foundations;
- dedicated Search and conservative EvidenceBundle APIs;
- ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase APIs;
- portable provider-side consumer contract kits;
- executable ephemeral staging/E2E architecture;
- fail-closed production-facing public product shell;
- public evidence-first Procedure Academy;
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

Zero documents are credited as ingested against a real, reviewed corpus. The minimum Antigua-first and comparative corpus is incomplete. Synthetic fixtures, deterministic examples, mocks, browser screenshots and PostgreSQL gates do not change these values.

## Next execution sequence

1. Implement `POST /api/public/v1/query` as a dedicated browser gateway with server-bound public tenant/corpus, exact origin/body/rate controls, public-only evidence, bounded citations, minimized audit and no browser service credential.
2. Execute the Feature 070 ephemeral staging runner and all twenty API/system journeys against disposable services.
3. Coordinate consumer-side suites in OS Electoral and Content Agency against immutable contract-kit SHAs.
4. Obtain authorization for Antigua-first corpus rights, durable storage, scanner, retention and legal-hold controls; then acquire, scan, ingest and evaluate real documents.
5. Add guarded GCP Terraform with `apply` remaining human-gated; create no resource before project, billing, region and budget approval.
6. Approve and implement human IdP/OIDC/PKCE/BFF/session, secure cookies, CSRF, logout, revocation, recovery and role-aware authenticated UI.
7. Enable browser E2E only after gateway, identity, fixtures and deployed staging pass lower-layer gates.
8. Complete human accessibility, load/HA, recovery/privacy operations, reviewed PR, protected merge, rollout and observation.

## Critical blockers

- `PPS-OPEN-GATEWAY-001`: the dedicated public query gateway is not implemented;
- `BLK-CORPUS-OPS-001`: source rights, approved durable storage, current scanner and retention/legal-hold controls are unavailable;
- zero real documents are credited as ingested and no judged real-corpus retrieval evidence exists;
- browser authentication/session architecture, approved IdP/OIDC/BFF, secure cookies/CSRF, provisioning, recovery and role-aware navigation remain unimplemented;
- no actual ephemeral environment has executed the twenty API/system journeys;
- OS Electoral and Content Agency repositories have not executed consumer suites;
- no production Terraform, workload identity, object store, scanner, dispatcher, observability/SLOs, load/HA, coordinated recovery or privacy operations exist;
- no reviewed PR, protected merge, deployment or observation window exists.

## Persistent boundary assertions

- There is no production object store, scanner/definitions monitor or dispatcher operating from this checkpoint.
- EvidenceGap is intake-only: there is no research assignment, resolution lifecycle or notification workflow.
- Browser service credentials are not human browser credentials and must never be placed in JavaScript storage.
- Provider-side contract stubs do not prove external consumer interoperability.
- GCP selection is architecture, not a resource receipt or deployment.
- Passing Feature 071 proves an honest fail-closed public surface, not production readiness.
