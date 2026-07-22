# LA Muni RAG — Current Program State

Updated: 2026-07-22T21:54:35Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 073 executes all twenty API/system staging journeys in disposable PostgreSQL and proves cleanup, while real corpus, browser identity/UI, external consumers, cloud staging and production release remain absent**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/ephemeral-staging-runner-v1
functional_commit: 4f6ab306d383f6d74808b393a88ff8172d666b5b
remote_functional_ref: 4f6ab306d383f6d74808b393a88ff8172d666b5b
pushed: true
remote_ci_run: 29959965725 success
PR_open: false
merged: false
cloud_staging_deployed: false
production_deployed: false
observed_in_production: false
cloud_resources_created: false
billable_actions: 0
```

`AGENTS.md` and `RTK.md` remain authoritative. Merge, deployment, paid infrastructure, project/billing creation, production credentials and legal conclusions remain human-gated.

## Feature 073 — ephemeral staging runner v1

The canonical Feature 070 staging plan is now executable. The runner:

- validates exact coverage of all twenty runnable API/system journeys;
- preserves all twelve browser journeys as explicitly blocked;
- requires a dedicated loopback PostgreSQL admin endpoint and explicit ephemeral confirmation;
- refuses unrelated databases and preserves an unapproved dirty environment;
- creates four fixed `_test` databases and three non-owner runtime roles;
- applies repository-controlled migrations/runtime gates and executes compiled HTTP/service smokes;
- uses exact viewer, document-manager, platform-admin, tenant-admin, integration-client, procedure-author, reviewer, approver and case-operator personas;
- drops and recreates the catalog database to verify reset-to-empty behavior;
- disables local dotenv and does not invoke a shell for child processes;
- requires a clean Git worktree so the receipt cites the exact functional SHA;
- validates a closed, sanitized receipt before writing mode `0600` under ignored `artifacts/staging/`;
- destroys run-owned databases and roles in `finally` and re-queries the postcondition.

## Verification

Exact detached checkout `4f6ab306d383f6d74808b393a88ff8172d666b5b`:

```text
EVAL-EPHEMERAL-STAGING-RUNNER-001: 14/14 pass
full suite: 856 total / 854 pass / 0 fail / 2 explicit environment skips
canonical contracts: 33 schemas / 33 examples / OpenAPI 3.1.1
consumer contracts: 2 kits / 5 interactions / 0 issues
staging plan: valid / 0 issues
typecheck: pass
build: pass
npm audit --audit-level=high: 0 vulnerabilities
npm audit --omit=dev --audit-level=high: 0 vulnerabilities
PostgreSQL: 16.14
pgvector: 0.8.5
API/system journeys: 20/20 pass
browser journeys: 12/12 blocked
created/destroyed databases: 4/4
created/destroyed runtime roles: 3/3
independent postcondition: 0 target databases / 0 target roles
Backend CI 29959965725: success, including Execute ephemeral staging runner
```

This proves the synthetic provider-side API/system staging lifecycle. It does not prove deployed cloud staging, human browser sessions, external consumers, real-corpus quality or production operation.

## Cumulative verified capabilities

- tenant identity/RBAC and transaction-local forced RLS;
- source/document/procedure catalog APIs;
- artifact acceptance, ingestion jobs, leases/fencing and tenant vectors;
- Search, conservative EvidenceBundle and public query gateway APIs;
- ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase APIs;
- provider-side consumer contract kits;
- fail-closed public product shell and Procedure Academy;
- disposable PostgreSQL runner for all twenty API/system staging journeys;
- accessibility, corruption, restore, boundary, tenant, artifact and vector hard gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Synthetic fixtures, staging receipts and database gates do not change those values. Zero documents are credited as ingested against a real, reviewed corpus. The minimum Antigua-first and comparative corpus is incomplete.

## Next execution sequence

1. Obtain authorization for Antigua-first corpus rights, durable storage, scanner, retention/legal-hold and named reviewers.
2. Acquire, scan, ingest and evaluate real public documents with immutable manifests.
3. Add guarded GCP Terraform with `apply` disabled by default; create no resource before project, billing, region and budget approval.
4. Provision isolated cloud staging only after approval and execute the same twenty journeys against deployed revisions.
5. Configure exact gateway origins, edge protection, telemetry, load/SLO controls and `PAGES_API_URL` only after real-corpus staging passes.
6. Coordinate consumer-side suites in OS Electoral and Content Agency.
7. Approve and implement IdP/OIDC/PKCE/BFF/session and role-aware authenticated UI.
8. Complete browser E2E, human accessibility, load/HA, recovery/privacy, reviewed PR, protected merge, rollout and observation.

## Critical blockers

- `PQG-OPEN-ENABLEMENT-001`: public gateway cannot be enabled without authorized ingested evidence, edge controls, deployed staging and approval;
- `BLK-CORPUS-OPS-001`: source rights, durable storage, scanner and retention/legal-hold controls are unavailable;
- zero real documents are credited as ingested and no judged real-corpus retrieval evidence exists;
- no approved human IdP/BFF/session or authenticated role-aware UI; twelve browser journeys remain blocked;
- external consumer repositories have not executed their suites;
- no GCP project/resources, deployed cloud staging, observability/SLO, load/HA, recovery or privacy operation exists;
- no reviewed PR, protected merge, deployment or observation window exists.

## Persistent boundary assertions

- Disposable API/system staging is not deployed cloud staging or production.
- The twelve browser journeys remain blocked; they were not counted as passed.
- GCP remains architecture only; zero resources and zero billable actions were created.
- EvidenceGap is intake-only; no research assignment, resolution lifecycle or notification workflow is implemented.
- There is no production object store, scanner/definitions monitor or dispatcher operating.
- Browser authentication/session architecture is not implemented. Human IdP/BFF/session, access review and role-aware navigation remain unimplemented.
- Provider-side kits do not prove external interoperability.
- A green feature branch and synthetic staging receipt are not production readiness.
