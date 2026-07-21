# LA Muni RAG — Current Program State

Updated: 2026-07-21T11:35:00Z

Program status: **PARTIAL — active implementation; production readiness is not yet proven**

## Persistent session policy

`AGENTS.md` is now the authoritative execution policy. Every resumed session must begin by checking workspace health and command execution, reconciling Git/root/upstream, reading runtime policy and checkpoints, preserving uncommitted work, and classifying blockers. Normal feature-branch commits, pushes, and draft PRs are authorized; merge, production deployment, force-push, spending, protected-branch mutation, external infrastructure, package publication, and destructive migration remain human-gated.

## Authoritative checkout

```text
workspace_id: 601929eb-4bf6-4900-8170-c15bf3a11ea0
root: /workspace
branch: feature/workflow-lifecycle-v1
functional_head: c6e110cd4ffe01cb8192cc1701f64827784ba240
remote_feature_ref: c6e110cd4ffe01cb8192cc1701f64827784ba240
pushed: true
merged: false
deployed: false
```

The Cloud Sandbox workspace record still says `error`, but its real capabilities are available: the container is running, filesystem and command execution work, Git is available, and all implementation/verification commands below executed successfully. The stale workspace state is a control-plane defect, not a repository failure.

## Commits produced in this slice

```text
d842b4e70bb68bdd547fb05d5547faf469208e1b  feat: add governed workflow lifecycle foundation
f3a145024a89ae92e4dab047d4c6b949ae611dfb  fix: harden postgres provider smokes
c6e110cd4ffe01cb8192cc1701f64827784ba240  feat: expose governed workflow lifecycle API v1
```

The state/report commit containing this file is intentionally separate from the functional commits.

## Implemented and verified

### Governed workflow lifecycle

Implemented HTTP routes:

```http
POST /api/v1/workflow-drafts
POST /api/v1/workflow-reviews
POST /api/v1/workflow-approvals
GET  /api/v1/workflows/{workflow_version_id}
```

Verified invariants:

- authentication and coarse RBAC complete before body parsing;
- request ID, tenant, nested workflow tenant, and credential provenance are bound server-side;
- every AI, human, or imported version starts `draft`;
- creator, reviewer, and approver are distinct;
- action-specific permissions protect submit, review, approve, supersede, archive, and read;
- exact idempotent replay returns exact bytes;
- changed payload conflicts and concurrent processing cannot lose another request's claim;
- invalid stored replay is committed as invalidated before a generic non-leaking error, and retry can regenerate safely;
- missing and cross-tenant identifiers return the same non-enumerating `404` form;
- approved content is immutable;
- atomic supersession approves a reviewed same-procedure replacement while superseding the former version and leaves exactly one approved row;
- forced RLS, composite tenant keys, append-only review/approval records, rate limits, and bounded audits are enforced in PostgreSQL.

### Cross-provider repairs

The production-shaped database pass found and repaired defects outside the lifecycle handler:

- ClaimPack retry-after SQL had an unbalanced `ceil(extract(...))` expression;
- ProcedureQuery smoke depended implicitly on `NODE_ENV` for legacy API disabling;
- ProcedureQuery/ClaimPack positive fixtures did not preserve a step-level citation pattern in the generated excerpt;
- EvidenceBundle smoke incorrectly required a claim even when the correct response was explicit `missing_evidence` abstention;
- workflow lifecycle audit persistence used the nonexistent `principal_id` column instead of canonical `actor_external_id`.

## Database evidence

Docker-in-Docker could download but not register the pinned pgvector image layers. The local gate therefore used an independently installed disposable runtime:

```text
PostgreSQL: 15.18
pgvector:   0.8.5
pgvector official tag commit: 159b7900f6246c7fe3d3b87232f2731b9e0ea597
cluster: /tmp/la-muni-workflow-pgdata
port: 55443
```

A fresh database and disposable roles were recreated from zero before final verification. The exact Backend-CI lifecycle path passed:

```text
001_initial_rag_schema.sql
002_procedure_feedback.sql
003_identity_tenancy_rbac.sql
004_procedure_query_api.sql
procedure_query_runtime_gate.sql
008_claim_pack_api.sql
claim_pack_runtime_gate.sql
009_workflow_lifecycle.sql
010_workflow_lifecycle_api.sql
workflow_lifecycle_runtime_gate.sql
```

Compiled HTTP smokes passed on that database for ProcedureQuery, ClaimPack, and workflow lifecycle. The workflow smoke demonstrated exact replay, human separation, atomic supersession, zero cross-tenant metadata leakage, corrupt-replay invalidation, and successful regeneration.

## Final local verification

```text
typecheck: pass
build: pass
workflow lifecycle focused tests: 35/35
contract registry: 16 schemas, 16 examples, 1 OpenAPI 3.1.1 document
integration contract tests: 15/15
global suite: 636 total, 634 pass, 0 fail, 2 explicit environment skips
source inventory: 17/17 structurally valid
domain evaluation: 8/8
Pages build and verifier: pass
npm audit --audit-level=high: 0 vulnerabilities
actionlint 1.7.11: pass
git diff --check: pass
```

Named hard evals:

```text
EVAL-PROCEDURE-001            4/4
EVAL-WATER-001                4/4
EVAL-MIXCO-001                4/4
EVAL-OS-INTEGRATION-001       5/5
EVAL-CONTENT-INTEGRATION-001  7/7
EVAL-CONFLICT-001             8/8
EVAL-BOUNDARY-001             4/4
EVAL-TENANT-001               4/4
EVAL-CORRUPT-001             20/20
```

These gates prove their fixtures and covered surfaces. They do not prove corpus completeness, current legal applicability, production deployment, or the full global Definition of Done.

## Independent critique and repairs

The producer/critic/verifier loop found and repaired:

1. impossible supersession semantics under the one-approved-version invariant;
2. an idempotency race that could release another request's active claim;
3. corrupt replay invalidation that would have rolled back with the emitted error;
4. lifecycle audit SQL drift from the canonical audit table;
5. ClaimPack PostgreSQL syntax not exercised by mocks;
6. CORS preflight advertising methods not supported by the specific route;
7. stale documentation and regression assertions after expanding OpenAPI;
8. a smoke fixture that encouraged unsupported claim expectations instead of fail-closed abstention.

No unresolved critical or high finding remains inside the lifecycle API slice. Global critical/high readiness remains unproved because independent workstreams are still incomplete.

## Publication state

A later authorized publication path succeeded. `git ls-remote` now reports:

```text
c6e110cd4ffe01cb8192cc1701f64827784ba240 refs/heads/feature/workflow-lifecycle-v1
```

The remote feature branch exactly matches the functional local HEAD. `origin/main` remains `4950ba3`; no merge or deployment is claimed. No pull-request ref was observed through Git, and remote CI status remains unverified. The earlier connector failure is retained as resolved historical evidence rather than an active blocker.

## Global gaps still open

- minimum Antigua corpus is not fully acquired, accepted, ingested, and evaluated;
- Mixco comparative corpus is incomplete;
- `ProcedureAssessment` and dedicated evidence-gap provider are missing;
- procedure cases are not yet a tenant-scoped server-side system of record;
- workflow review/approval UI, authenticated document library UI, and accessibility proof are incomplete;
- semantic conflict resolution and version applicability remain human-review gaps;
- external OS Electoral and Content Agency consumers have not passed cross-repository contract tests;
- production observability, load/HA, Terraform, secrets architecture, backup/restore drill, rollback drill, and staging evidence are incomplete;
- protected merge and deployment require human approval.

## Ready work

Highest-value independent ready tasks:

1. `WS04-CONFLICT-RESOLUTION-001` — persistent conflict/version applicability review service;
2. `WS08-PROCEDURE-ASSESSMENT-001` — ProcedureAssessment and EvidenceGap APIs;
3. `WS06-CASE-LIFECYCLE-001` — tenant-scoped procedure case persistence and API;
4. `WS09-WORKFLOW-UI-001` — authenticated review/approval UI with accessibility gates;
5. `WS02-CORPUS-ACQUISITION-001` — acquire, validate, accept, and ingest the minimum Antigua/Mixco corpus;
6. `WS10-PLATFORM-001` — production topology, Terraform, observability, backup/restore, and release runbooks.

## Exact resume condition

1. read `AGENTS.md` and `RTK.md`, then verify workspace status, command execution, `pwd`, branch, clean worktree, local HEAD, remote refs, and upstream;
2. confirm the remote feature ref matches the local checkpoint HEAD;
3. push only through the authorized connector when the checkpoint advances;
4. inspect remote CI and PR state when an available tool can prove them;
5. do not merge or deploy automatically;
6. claim the highest-value ready task above and repeat producer → critic → repair → independent verification.
