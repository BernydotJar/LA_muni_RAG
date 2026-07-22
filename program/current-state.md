# LA Muni RAG — Current Program State

Updated: 2026-07-22T01:05:41Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 069 is a published, independently verified provider-side contract checkpoint; global production readiness is not proven**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/consumer-contract-kit-v1
functional_commit: 5e5481e26b1a27a0aa2bd9c965e1c160f18b3198
remote_functional_ref: 5e5481e26b1a27a0aa2bd9c965e1c160f18b3198
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
pushed: true
PR_open: false
merged: false
deployed: false
observed_in_production: false
remote_ci_run: 29882062536 success
```

`AGENTS.md` and `RTK.md` remain authoritative. Protected merge, production deployment, paid/external infrastructure, sensitive credential use, legal conclusions and modifications to neighboring products remain human-gated.

## Feature 069 — portable consumer contract kits v1

Published provider-side artifacts:

```text
contracts/consumer-kits/v1/os-electoral.json
contracts/consumer-kits/v1/content-agency.json
contracts/consumer-kits/v1/consumer-contract-kit.schema.json
```

Verified scope:

- exactly two allowlisted consumer kits and five interactions;
- OS Electoral: EvidenceBundle, ProcedureWorkflow, ProcedureAssessment and EvidenceGapResponse;
- Content Agency: ClaimPack delivery;
- exact OpenAPI path, method, request headers, response correlation header, success/error statuses and schemas;
- canonical request/response/error examples validated against JSON Schema draft 2020-12;
- each ProcedureQuery example binds its `requested_output` explicitly;
- complete interaction inventories cannot be silently reduced;
- consumer-owned campaign/content fields are rejected in response schemas and examples;
- non-allowlisted kit paths are rejected before filesystem access;
- provider-side CLI and CI are deterministic and offline.

This feature does **not** modify OS Electoral or Content Agency and does not prove that either repository consumes, persists or retries these contracts correctly.

## Verification

Exact detached checkout `5e5481e26b1a27a0aa2bd9c965e1c160f18b3198`:

```text
npm ci --ignore-scripts --prefer-offline: pass
full suite: 795 total / 793 pass / 0 fail / 2 explicit environment skips
EVAL-CONSUMER-CONTRACT-KIT-001: 16/16 pass
canonical contracts: 30 schemas / 30 examples / OpenAPI 3.1.1
portable kits: 2 kits / 5 interactions / 0 issues
typecheck: pass
build: pass
source inventory: 17 valid / 4 verified / 1 acquisition metadata / 0 ingested
domain evaluation: 8/8
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
git diff --check: pass
```

Backend CI run `29882062536` completed with `success` on the exact functional SHA. A green local or remote feature branch is not a PR, merge, staging deployment or production release.

## Cumulative product capabilities

- governed tenant source/document/procedure catalogs;
- exact artifact acceptance and durable ingestion job/vector foundations;
- dedicated Search and conservative EvidenceBundle APIs;
- ProcedureQuery EvidenceBundle, ProcedureWorkflow and ProcedureAssessment;
- ClaimPack and immutable EvidenceGapRequest providers;
- governed workflow lifecycle and tenant ProcedureCase lifecycle;
- provider-side portable consumer contract manifests;
- public evidence-first Procedure Academy;
- disposable PostgreSQL/RLS, compiled HTTP and logical restore gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Synthetic examples, manifests and PostgreSQL fixtures do not change these values. A URL, hash or green contract test is not durable acquisition, current scan, ingestion, retrieval quality, legal validity or human applicability review.

## Best path forward

1. **Consumer-side contract verification.** Pin the exact Feature 069 SHA in OS Electoral and Content Agency and run equivalent schema/OpenAPI/preservation tests in each repository.
2. **Identity and deterministic staging.** Decide the human IdP/OIDC/BFF/session architecture; define ephemeral tenant fixtures, integration credentials and resettable data without production secrets.
3. **System/API journeys.** Exercise auth, tenant isolation, replay, expiry, supersession, failure/retry and cross-product preservation through deployed ephemeral services.
4. **E2E last.** Add browser journeys only after contracts, identity, fixtures and staging topology are stable. E2E should validate user outcomes, not discover schema, authorization or persistence defects that lower layers should catch.

## Critical global blockers

### Corpus and retrieval

- source rights, approved durable storage, current scanner and retention/legal-hold controls are unavailable (`BLK-CORPUS-OPS-001`);
- zero real documents are credited as ingested;
- no judged Antigua-first retrieval quality, latency, cost or load evidence exists;
- human authority, vigencia, supersession, jurisdiction and applicability review remains mandatory.

### Human SaaS and E2E prerequisites

- no approved IdP/OIDC/PKCE/BFF/session architecture;
- no secure cookies, CSRF, provisioning, logout, revocation or recovery;
- no authenticated role-aware source/library/search/case/review/admin/audit UI;
- no deterministic staging identities/data or browser E2E environment;
- no supported-browser, screen-reader or human WCAG 2.2 AA evidence.

### Platform, integration and release

- no production Terraform, workload identity, secrets, object store, scanner, dispatcher, observability/SLOs, staging, load/HA or coordinated recovery;
- no cross-repository consumer suites have run;
- no reviewed PR, protected merge, deployment or observation window exists;
- legal, privacy, security and release approvals remain human-gated.

## Persistent open-boundary assertions

- There is no production object store, and no production scanner/definitions monitor or dispatcher is operating from this repository checkpoint.
- Zero documents are credited as ingested against a real, reviewed corpus.
- EvidenceGap is intake-only: there is no research assignment, resolution lifecycle or notification workflow.
- The minimum Antigua-first and comparative corpus is incomplete.
- Browser authentication/session architecture, approved IdP/OIDC/BFF, secure cookies/CSRF, provisioning, recovery, and role-aware navigation remain unimplemented.
- Provider-side contract kits do not prove external consumer interoperability.
