# LA Muni RAG — Current Program State

Updated: 2026-07-22T00:15:00Z

Program status: **PARTIAL — Feature 068 is a locally verified production-shaped backend candidate; global production readiness is not proven**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/search-evidence-api-v1
base_remote_ref: origin/feature/catalog-api-v1
base_sha: 4343e5dc14595ff24a559a4e7476cde067be1539
functional_candidate: uncommitted local worktree pending final review
pushed: false
PR_open: false
merged: false
deployed: false
observed_in_production: false
remote_ci_run: none for Feature 068
```

`AGENTS.md` and `RTK.md` remain authoritative. Normal feature-branch commits,
pushes and verification are authorized. Protected merge, production deployment,
paid/external infrastructure, sensitive credential use and legal conclusions
remain human-gated.

## Feature 068 — dedicated Search and EvidenceBundle API v1

Implemented routes:

```text
POST /api/v1/search
POST /api/v1/evidence-bundles
```

Implemented behavior:

- bearer authentication and `evidence:query` authorization precede body parsing;
- request, tenant and credential identities are bound to the authenticated principal;
- all PostgreSQL retrieval and control-state work executes in a transaction-local
  tenant context with forced RLS;
- Search supports explicit `keyword`, `phrase`, `semantic` and `hybrid` modes;
- semantic and hybrid requests fail closed with `503 capability_unavailable`
  when the query-embedding provider is missing, incompatible, timed out or fails;
- query embedding executes outside PostgreSQL transactions with a bounded HTTP timeout;
- hybrid proves semantic capability first and never claims semantic execution
  after a lexical-only fallback;
- candidates require source `acquired/ingested/indexed`, active public documents,
  processed extraction, exact accepted clean artifact state, processed ingestion
  job, citable identity, public URL and SHA-256 provenance;
- runtime grants are column-scoped and do not expose object coordinates, scanner
  engine/version, lease/fencing material or pipeline configuration;
- authority, temporal and evidence-use states are derived from persisted
  server-owned fields and an explicit request `as_of_date`;
- citation identity is deduplicated, negative cosine similarity is clamped to zero,
  and score semantics are named explicitly;
- ordinary EvidenceBundle claims require `supported` evidence and preserve the
  exact bounded documentary excerpt;
- comparative and validation-required material remains visible as evidence but
  is never promoted to an ordinary supported claim;
- Mixco/comparative material retains an Antigua/national corroboration gap;
- conflicting document versions produce review-required positions,
  contradictions and missing-evidence actions without selecting a winner;
- EvidenceBundle uses principal-scoped digest-only idempotency, byte-exact replay,
  semantic replay validation and committed deletion of corrupt completed state;
- closed JSON Schemas reject caller-selected authority, validation, retrieval,
  score-threshold and support fields;
- OpenAPI 3.1.1 describes exact methods, headers, schemas and response statuses.

## Feature 067 — governed tenant Catalog API v1

Previously implemented and retained routes:

```text
GET  /api/v1/sources
POST /api/v1/sources
GET  /api/v1/documents
POST /api/v1/documents
GET  /api/v1/ingestion-jobs
GET  /api/v1/procedures
```

Catalog registration remains fail closed: it cannot establish official authority,
artifact acceptance, acquisition, ingestion, retrieval quality, vigencia, legal
validity or deployment.

## Local verification of the Feature 068 candidate

```text
contracts: 30 schemas / 30 examples / OpenAPI 3.1.1
EVAL-SEARCH-API-001: 24/24 pass
EVAL-EVIDENCE-BUNDLE-API-001: 24/24 pass
full suite: 779 total / 777 pass / 0 fail / 2 explicit environment skips
typecheck: pass
build: pass
domain evaluation: 8/8
source inventory: 17 valid / 4 verified / 1 acquisition metadata / 0 ingested
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
GitHub Pages artifact verification: pass
git diff --check: pending final staged review
```

Fresh disposable PostgreSQL verification:

```text
PostgreSQL: 16.14
pgvector image: 0.8.5-pg16-bookworm
fresh migrations: 001–015 pass
runtime role: non-owner / NOSUPERUSER / NOBYPASSRLS
search/evidence SQL/RLS gate: pass
eligible public fixture evidence: 2
private artifact columns granted: false
cross-tenant leak: false
compiled Search/EvidenceBundle HTTP smoke: pass
HTTP decisions: 503/401/200/200/200/200/200/409/500/403/200
semantic executed when explicitly configured: true
hybrid executed with keyword/phrase/semantic: true
comparative evidence promoted to ordinary claim: false
exact replay: true
corrupt replay cleanup committed: true
```

The PostgreSQL corpus and query-embedding provider used by the gate are controlled
test fixtures. They prove integration mechanics and safety boundaries, not
real-corpus relevance, legal correctness, provider reliability or production
capacity.

## Cumulative product capabilities

- source inventory and fail-closed tenant source registration;
- document/version registration and safe catalog projection;
- exact artifact-acceptance foundation;
- durable ingestion jobs, retry, leases, fencing and tenant vectors;
- dedicated Search and EvidenceBundle v1 providers;
- ProcedureQuery outputs: EvidenceBundle, ProcedureWorkflow and conservative
  ProcedureAssessment;
- workflow draft/review/approval/read lifecycle;
- EvidenceGap and ClaimPack providers;
- tenant ProcedureCase create/read/update lifecycle;
- public evidence-first Procedure Academy;
- disposable logical PostgreSQL restore drill;
- named hard-eval families plus ProcedureAssessment, EvidenceGap, Source API,
  Document API, Search API and EvidenceBundle API gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

API registration and synthetic PostgreSQL fixtures do not change these values. A
URL or SHA-256 declaration is not durable acquisition, clean scan, extraction,
ingestion, retrieval quality or human legal review.

## Minimum API status

The product-minimum route names requested by the program now have local,
production-shaped implementations. This closes the missing-route gap only. It
does not establish production equivalence without real corpus, human SaaS,
consumer contracts, infrastructure, operational evidence, protected merge and
observed deployment.

## Critical global gaps

### Corpus and retrieval

- authorized durable object storage and current production scanner operation;
- exact Antigua-first and national artifact acquisition;
- real extraction, chunks, embeddings and operational manifest reconciliation;
- real keyword/phrase/semantic/hybrid quality and performance evaluation;
- human citation, authority, vigencia, supersession, applicability and
  contradiction review;
- zero documents are credited as ingested against a real reviewed corpus.

### Human SaaS

- browser authentication/session architecture and approved human IdP/OIDC
  authorization-code-with-PKCE plus BFF/session model;
- secure cookies, CSRF, logout, revocation and account recovery;
- tenant/member/role provisioning and periodic access review;
- role-aware navigation and authenticated source viewer, library, search, cases,
  reviews, administration and audit surfaces;
- supported-browser, screen-reader and human WCAG 2.2 AA evidence.

### Platform and operations

- Terraform/environment provisioning, workload identity and production secrets;
- no production object store, scanner/definitions monitor or dispatcher is
  operating from this checkpoint;
- quotas, cancellation and dead-letter operator tooling;
- metrics, traces, logs, SLOs and exercised alerts;
- staging, load, capacity and HA evidence;
- coordinated object/database restore, PITR, KMS/key recovery and approved RPO/RTO;
- privacy purpose, retention, deletion/legal-hold and DSAR operations.

### Research gaps

- EvidenceGap is intake-only: there is no research assignment, resolution lifecycle or notification workflow;
- the minimum Antigua-first and comparative corpus is incomplete.

### Integration and release

- cross-repository OS Electoral and Content Agency consumer suites;
- human-reviewed PR and protected merge;
- production deployment and observation window;
- legal, privacy, security and release approvals.

## Ready work after Feature 068 publication

1. `WS02-CORPUS-ACQUISITION-001` — authorized durable Antigua-first corpus,
   current scan, extraction and ingestion.
2. `WS04-REAL-CORPUS-RETRIEVAL-001` — judged real-corpus retrieval, citation and
   conflict quality across keyword, phrase, semantic and hybrid modes.
3. `WS09-AUTH-SHELL-001` — human IdP/session/BFF and role-aware authenticated shell
   after human architecture decisions.
4. `WS10-PLATFORM-001` — staging, observability, load/HA, privacy operations and
   coordinated recovery.
5. Consumer repository contract tests, reviewed PR, protected merge and observed
   deployment.

## Exact resume condition

1. Verify workspace, branch, HEAD, upstream, worktree and remote SHA.
2. Finish staged diff review, secret/dependency/license checks and local gates.
3. Commit Feature 068, verify it from a detached clean checkout and repeat fresh
   PostgreSQL 001–015 plus compiled smoke.
4. Push the exact feature SHA and inspect remote CI without inferring merge or
   deployment.
5. Reconcile task graph, ledger, roadmap, risk/findings/evals and receipt in a
   separate checkpoint commit.
6. Do not merge, deploy, provision paid infrastructure, issue legal conclusions,
   or implement OS Electoral/Content Agency automatically.
