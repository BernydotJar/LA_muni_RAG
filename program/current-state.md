# LA Muni RAG — Current Program State

Updated: 2026-07-22T16:53:05Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 070 provides an executable staging/E2E architecture; no deployed staging, browser E2E, or production readiness is claimed**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/ephemeral-staging-e2e-architecture-v1
functional_commit: f4d018f0909d15408092167cb935bf4ac71cd6d9
remote_functional_ref: f4d018f0909d15408092167cb935bf4ac71cd6d9
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
pushed: true
remote_ci_run: 29939453123 success
PR_open: false
merged: false
deployed: false
observed_in_production: false
```

`AGENTS.md` and `RTK.md` remain authoritative. Protected merge, production deployment, paid or external infrastructure, sensitive credentials, legal conclusions, and modifications to neighboring products remain human-gated.

## Feature 070 — executable ephemeral staging and E2E architecture v1

Machine-readable source:

```text
contracts/staging/v1/ephemeral-staging-plan.schema.json
contracts/staging/v1/ephemeral-staging-plan.json
```

Verified architecture:

- per-run isolation, fresh database, 120-minute maximum TTL, loopback-only networking, mandatory destruction;
- no production credentials or production data;
- two synthetic tenants, eleven principals, exact ten-role RBAC, thirteen deterministic non-authoritative fixtures;
- ordered reset with ten steps, mutable-resource coverage, sanitized artifacts, empty-state checks, and destruction postconditions;
- twenty runnable API/system journeys aligned to canonical OpenAPI routes, statuses, and runtime permissions;
- twelve planned browser journeys covering the required human roles, all blocked by `BLK-HUMAN-IDP-BFF-001` and `BLK-AUTHENTICATED-UI-001`;
- strict API-versus-browser concern ownership;
- deterministic loopback provider stubs and explicit boundary-only treatment of object storage and malware scanning;
- OS Electoral and Content Agency remain provider-contract-only mocks; external interoperability is not claimed;
- secret-like material, production endpoints, RBAC drift, permission drift, reset weakening, layer misuse, and external-consumer overclaims fail closed.

Execution summary:

```text
plan_version: 1.0.0
tenants: 2
principals: 11
roles: 10
fixtures: 13
api_system_journeys: 20
browser_journeys: 12
blocked_browser_journeys: 12
mocks: 6
reset_steps: 10
external_consumers_verified: false
browser_e2e_runnable: false
```

## Verification

Exact detached checkout `f4d018f0909d15408092167cb935bf4ac71cd6d9`:

```text
npm ci --ignore-scripts --prefer-offline: pass
EVAL-EPHEMERAL-STAGING-E2E-001: 13/13 pass
full suite: 808 total / 806 pass / 0 fail / 2 explicit environment skips
canonical contracts: 30 schemas / 30 examples / OpenAPI 3.1.1
consumer contracts: 2 kits / 5 interactions / 0 issues
staging plan: valid / 0 issues
typecheck: pass
build: pass
source inventory: 17 valid / 4 verified / 1 acquisition metadata / 0 ingested
domain evaluation: 8/8
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
Backend CI 29939453123: success
```

A green architecture plan and CI run are not deployed staging, browser execution, a reviewed PR, protected merge, or production release.

## Cumulative capabilities

- tenant identity/RBAC and transaction-local forced-RLS foundations;
- governed source/document/procedure catalogs;
- artifact acceptance, ingestion jobs, leases/fencing, and tenant-vector foundations;
- dedicated Search and conservative EvidenceBundle APIs;
- ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle, and ProcedureCase APIs;
- portable provider-side consumer contract kits;
- executable ephemeral staging/E2E architecture;
- public evidence-first Procedure Academy;
- disposable PostgreSQL, compiled HTTP, accessibility, and logical restore gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Synthetic examples, deterministic fixtures, mocks, and PostgreSQL gates do not change these values.

## Next execution sequence

1. Implement a local ephemeral staging runner that realizes the declared lifecycle with a fresh disposable database and executes the twenty API/system journeys.
2. Coordinate independent consumer-side suites in OS Electoral and Content Agency against an immutable contract-kit SHA; do not simulate them from this repository.
3. Obtain and implement the human IdP/OIDC/PKCE/BFF/session decision, secure cookies, CSRF, logout, revocation, recovery, and provisioning.
4. Build the role-aware authenticated UI and deploy deterministic fixtures to isolated ephemeral services.
5. Enable the twelve browser journeys only after all lower-layer and identity prerequisites pass.
6. Add human accessibility evidence, load/HA, recovery/privacy operations, reviewed PRs, protected merge, staging rehearsal, deployment, and observation.

## Critical blockers

- `BLK-CORPUS-OPS-001`: source rights, approved durable storage, current scanner, and retention/legal-hold controls are unavailable;
- zero real documents are credited as ingested and no judged real-corpus retrieval evidence exists;
- no approved human IdP/BFF/session architecture or authenticated role-aware SaaS UI exists;
- no actual ephemeral environment has been provisioned and no browser journey has executed;
- OS Electoral and Content Agency repositories have not executed their consumer suites;
- no production Terraform, workload identity, secrets, object store, scanner, dispatcher, observability/SLOs, load/HA, coordinated recovery, or privacy operations exist;
- no reviewed PR, protected merge, deployment, or observation window exists.

## Persistent boundary assertions

- Zero documents are credited as ingested against a real, reviewed corpus.
- EvidenceGap is intake-only: there is no research assignment, resolution lifecycle, or notification workflow.
- The minimum Antigua-first and comparative corpus is incomplete.
- Browser authentication/session architecture, approved IdP/OIDC/BFF, secure cookies/CSRF, provisioning, recovery, and role-aware navigation remain unimplemented.
- There is no production object store, scanner/definitions monitor, or dispatcher operating from this checkpoint.
- EvidenceGap remains intake-only; no research assignment or resolution lifecycle is deployed.
- Browser service credentials are not human browser credentials and must never be placed in JavaScript storage.
- Provider-side contract stubs do not prove external consumer interoperability.
- Passing Feature 070 proves architecture conformance only, not production readiness.
