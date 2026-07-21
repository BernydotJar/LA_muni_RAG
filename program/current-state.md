# LA Muni RAG — Current Program State

Updated: 2026-07-21T23:20:48Z

Program status: **PARTIAL — production-shaped backend checkpoint; global production readiness is not proven**

## Authoritative checkout

```text
workspace_id: 601929eb-4bf6-4900-8170-c15bf3a11ea0
root: /workspace
branch: feature/catalog-api-v1
functional_head: 9da29720c23d64bc73bdb24e92e67707834f4f84
remote_functional_ref: 9da29720c23d64bc73bdb24e92e67707834f4f84
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
worktree: clean
pushed: true
PR_open: false
merged: false
deployed: false
observed_in_production: false
remote_ci_run: 29876782983
remote_ci_status_at_checkpoint: in_progress
```

`AGENTS.md` and `RTK.md` remain authoritative. Normal feature-branch commits,
pushes and verification are authorized. Protected merge, production deployment,
paid/external infrastructure, sensitive credential use and legal conclusions
remain human-gated.

## Feature 067 — governed tenant Catalog API v1

Implemented routes:

```text
GET  /api/v1/sources
POST /api/v1/sources
GET  /api/v1/documents
POST /api/v1/documents
GET  /api/v1/ingestion-jobs
GET  /api/v1/procedures
```

Security and governance properties:

- Bearer authentication and permission checks precede POST body parsing;
- authenticated credential tenant is authoritative;
- `source:read/write`, `document:read/write/ingest` and `procedure:read` are
  enforced server-side;
- all catalog-owned persistence uses transaction-local tenant context and
  `FORCE ROW LEVEL SECURITY`;
- source registration is always `unreviewed`, non-official, not acquired, not
  ingested and not indexed;
- comparative sources receive the mandatory non-Antigua warning;
- caller-selected authority, validity, artifact acceptance, ingestion or
  retrieval-completion fields are rejected by closed JSON Schemas;
- document registration requires an existing tenant source and exact SHA-256;
- new documents remain `draft`, extraction `queued`, artifact `not_accepted`,
  ingestion `not_started` and retrieval `not_indexed`;
- private object coordinates, signed URLs, scanner internals, lease/fencing
  values, pipeline configuration, raw errors and workflow definitions are
  excluded through explicit SQL projections and column-level grants;
- public URLs with embedded credentials or common temporary-signature parameters
  are rejected by both HTTP and PostgreSQL constraints;
- keyset pagination is bounded to 1–100 records;
- idempotency stores digest-only key/request identity and exact response bytes;
- replay requires SHA-256, current schema, tenant/request/credential/audit
  identity, persisted aggregate identity and exact canonical reconstruction;
- schema-valid semantic replay corruption is deleted in a committed transaction
  before a generic error is returned;
- repeated rate-limit denials remain `429` and produce at most one audit record
  per blocked window.

## Verification

Exact detached checkout `9da29720c23d64bc73bdb24e92e67707834f4f84`:

```text
npm ci --ignore-scripts --prefer-offline: pass
full suite: 749 total / 747 pass / 0 fail / 2 explicit environment skips
typecheck: pass
build: pass
contracts: 27 schemas / 27 examples / OpenAPI 3.1.1
domain evaluation: 8/8
source inventory: 17 valid / 4 verified / 1 acquisition metadata / 0 ingested
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
git diff --check: pass
```

Independent disposable PostgreSQL verification:

```text
PostgreSQL: 15.18
pgvector: 0.8.5
fresh migrations: 001–014 pass
runtime role: non-owner / NOSUPERUSER / NOBYPASSRLS
catalog SQL/RLS gate: pass
compiled catalog HTTP smoke: pass
HTTP decisions: 401/201/201/409/500/400/201/201/200/200/200/200/403/200
source authority promoted: false
private artifact columns granted: false
cross-tenant leak: false
corrupt replay cleanup committed: true
```

Named new evals:

```text
EVAL-SOURCE-API-001: 18/18 pass
EVAL-DOCUMENT-API-001: 18/18 pass
```

The lockfile was updated from vulnerable transitive `fast-uri@3.1.3` to
`fast-uri@3.1.4`; no direct dependency was added and both dependency audits pass.

## Cumulative product capabilities

- source inventory and unreviewed tenant source registration;
- document/version registration and safe catalog projection;
- exact artifact-acceptance foundation;
- durable ingestion jobs, retry, leases, fencing and tenant vectors;
- ProcedureQuery outputs: EvidenceBundle, ProcedureWorkflow and conservative
  ProcedureAssessment;
- workflow draft/review/approval/read lifecycle;
- EvidenceGap and ClaimPack providers;
- tenant ProcedureCase create/read/update lifecycle;
- public evidence-first Procedure Academy;
- disposable logical PostgreSQL restore drill;
- all nineteen goal-required hard-eval families plus ProcedureAssessment,
  EvidenceGap, Source API and Document API gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Catalog registration does not change these values. A URL or SHA-256 declaration
is not durable acquisition, clean scan, extraction, ingestion or retrieval proof.

## Remaining minimum API work

Still missing as production-equivalent v1 routes:

```text
POST /api/v1/search
POST /api/v1/evidence-bundles
```

`EvidenceBundle` already exists as a `procedure-queries` output, but the dedicated
route and independent search contract/runtime gate remain unimplemented.

## Critical global gaps

### Corpus and retrieval

- authorized durable object storage and current scanner operation;
- exact Antigua-first/national artifact acquisition;
- extraction, chunks, embeddings and operational manifest reconciliation;
- real keyword/phrase/semantic/hybrid quality evaluation;
- human citation, authority, applicability and contradiction review;
- zero documents are currently credited as ingested.

### Human SaaS

- approved IdP/OIDC authorization-code-with-PKCE and BFF/session architecture;
- secure cookie, CSRF, logout, revocation and account recovery;
- tenant/member/role provisioning and access review;
- authenticated source, document, ingestion, search, workflow, case, audit and
  administration surfaces;
- supported-browser, screen-reader and human WCAG 2.2 AA evidence.

### Platform and operations

- Terraform/environment provisioning, workload identity and production secrets;
- production object store, scanner definitions monitor, dispatcher, quotas,
  cancellation and dead-letter operator tooling;
- metrics, traces, logs, SLOs and exercised alerts;
- staging, load, capacity and HA evidence;
- coordinated object/database restore, PITR, KMS/key recovery and approved RPO/RTO;
- privacy purpose, retention, deletion/legal-hold and DSAR operations.

### Integration and release

- cross-repository OS Electoral and Content Agency consumer suites;
- human-reviewed PR and protected merge;
- production deployment and observation window;
- legal, privacy, security and release approvals.

## Ready work

1. `WS05-SEARCH-EVIDENCE-API-001` — dedicated search and EvidenceBundle endpoints
   with tenant filters, citations, replay and PostgreSQL runtime gates.
2. `WS02-CORPUS-ACQUISITION-001` — authorized durable Antigua-first corpus,
   current scan, extraction and ingestion.
3. `WS04-REAL-CORPUS-RETRIEVAL-001` — judged real-corpus retrieval and citation
   quality.
4. `WS09-AUTH-SHELL-001` — human IdP/session/BFF after human architecture decision.
5. `WS10-PLATFORM-001` — staging, observability, load/HA and coordinated recovery.

## Exact resume condition

1. Verify workspace status, command execution, branch, HEAD, upstream and remote SHA.
2. Confirm Backend CI run `29876782983` for exact functional SHA `9da2972`.
3. Inspect protected-main and PR state; do not infer merge or deployment.
4. Preserve the zero-ingested corpus statement and catalog non-promotion boundary.
5. Continue with the dedicated search/EvidenceBundle slice or another independent
   ready task using producer → critic → fixer → detached verifier → remote CI.
6. Do not merge, deploy, provision paid infrastructure or issue legal conclusions
   automatically.
