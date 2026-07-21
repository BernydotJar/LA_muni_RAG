# LA Muni RAG — Current Program State

Updated: 2026-07-21T19:36:34Z

Program status: **PARTIAL — active implementation; global production readiness is not proven**

## Policy and authoritative checkout

`AGENTS.md` is authoritative. Feature-branch edits, tests, disposable databases,
semantic commits, pushes, remote-SHA verification, and draft PR creation are
authorized. Protected merge, production deployment, force-push, destructive
migration, spending, external infrastructure, package publication, and legal
conclusions remain human-gated.

```text
workspace_id: 601929eb-4bf6-4900-8170-c15bf3a11ea0
root: /workspace
branch: feature/evidence-gap-request-v1
functional_head: 66b41b943242d9c4317d35f125de1cd617ebb6e4
remote_functional_ref: 66b41b943242d9c4317d35f125de1cd617ebb6e4
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
worktree: clean
pushed: true
PR_open: false
merged: false
deployed: false
remote_ci_run: 29861888791
remote_ci_check: 88740409681
remote_ci_status_at_checkpoint: completed_success
```

The workspace control plane still carries stale `error` metadata, but container,
exec, filesystem, Git, PostgreSQL, pgvector, tests and publication work. Exact
remote refs and GitHub CI API receipts are authoritative for publication and CI.

## Feature 062 — immutable EvidenceGapRequest provider v1

```text
66b41b943242d9c4317d35f125de1cd617ebb6e4  feat: add immutable evidence gap intake v1
```

Implemented and verified:

- `POST /api/v1/evidence-gap-requests` accepts a closed, authenticated,
  tenant-scoped OS Electoral documentary research intake;
- authentication completes before body parsing and the authenticated rate gate
  runs before permission/schema validation;
- `integration:query`, tenant, credential provenance, request ID, CORS and
  product boundaries are enforced server-side;
- one immutable tenant aggregate enters `open` and all echoed requester text is
  explicitly `requester_supplied_unverified`;
- intake performs no retrieval, compilation or research resolution and cannot
  declare a source official, current, applicable, acquired, ingested or resolved;
- transport replay and aggregate identity are distinct: same-key replay,
  in-progress fencing, key conflict, second-key aggregate replay and aggregate
  identity conflict are separately enforced;
- concurrent distinct keys converge on one aggregate and the exact original
  acknowledgement;
- stored bytes require SHA-256, current schema, tenant/request/gap/credential/audit
  identity and exact canonical response reconstruction before replay;
- corrupt or schema-valid-but-noncanonical replay is invalidated without leakage;
- audit excludes Bearer, raw keys, subject, missing-document text, reason and
  campaign reference;
- migration 012 adds forced-RLS aggregate/idempotency/rate state, composite tenant
  foreign keys, response-hash constraints, aggregate immutability and a bounded
  pre-tenant authentication-failure sink.

## Verification

A detached checkout at `66b41b943242d9c4317d35f125de1cd617ebb6e4`
used a real `npm ci --ignore-scripts --prefer-offline` install.

```text
typecheck: pass
build: pass
contracts: 17 schemas / 17 examples / OpenAPI 3.1.1
EVAL-EVIDENCE-GAP-001 + migration boundary: 14/14
global suite: 669 total / 667 pass / 0 fail / 2 explicit environment skips
source inventory: 17 valid / 4 verified / 1 acquired / 0 ingested
domain evaluation: 8/8
Pages: pass
npm audit --audit-level=high: 0 vulnerabilities
git diff --check: pass
Backend CI 29861888791 / check 88740409681: completed success
```

A clean disposable PostgreSQL 15.18 / pgvector 0.8.5 database ran the shared
provider sequence from zero:

```text
migrations/gates 001–004: pass
migration/gate 008 ClaimPack: pass
migrations/gates 009–010 workflow lifecycle: pass
migration/gate 012 EvidenceGap: pass
runtime role: non-owner / NOSUPERUSER / NOBYPASSRLS
compiled ProcedureQuery smoke: pass
compiled ClaimPack smoke: pass
compiled workflow lifecycle smoke: pass
compiled EvidenceGap smoke: pass
```

EvidenceGap HTTP statuses were
`401/200/200/200/200/200/409/409/403/400/400/500/200`, including exact key
replay, aggregate replay, concurrent convergence, cross-tenant denial, authority
and product-boundary refusals, corrupt replay denial, and recovery.

## Named eval status

Fourteen named families pass:

```text
PROCEDURE; WATER; MIXCO; OS-INTEGRATION; PROCEDURE-ASSESSMENT;
EVIDENCE-GAP; CONTENT-INTEGRATION; CONFLICT; BOUNDARY; TENANT;
CORRUPT; ARTIFACT; VECTOR; JOB-LEASE.
```

Still missing as dedicated scope-equivalent gates:

```text
EVAL-SOURCE-001; EVAL-MISSING-001; EVAL-RBAC-001; EVAL-INGEST-001;
EVAL-CASE-001; EVAL-ACCESSIBILITY-001; EVAL-RESTORE-001.
```

Partial coverage elsewhere is not promoted to a passing named gate.

## Resolved Feature 062 findings

1. Critical: the initial migration referenced a nonexistent credential table.
2. High: request priority `critical` and migration priority `urgent` diverged.
3. High: the initial response contract referenced a nonexistent shared definition.
4. High: copied ClaimPack scaffolding could have introduced compiler/expiry/content semantics.
5. High: schema-valid stored bytes could have altered limitations and authority semantics.
6. High: source-authority laundering could be hidden in requester text.
7. High: concurrent transport keys required aggregate-level convergence proof.

No critical/high code finding remains open inside Feature 062. This does not
apply to the global program or the external/privacy limitations below.

## Global gaps

- minimum Antigua-first and comparative corpus is incomplete; zero documents are
  credited as ingested;
- no production object store, scanner/definitions monitor, dispatcher, quotas,
  cancellation, dead-letter UI, observability, load or HA;
- procedure queries do not consume evaluated tenant-vector retrieval;
- source/document/search/dedicated EvidenceBundle/procedure catalog and case APIs
  remain incomplete;
- EvidenceGap is intake-only: no research assignment, resolution lifecycle,
  notification or consumer interoperability exists;
- immutable EvidenceGap text still needs an approved purpose, retention,
  deletion/legal-hold and privacy policy;
- procedure cases remain browser-local;
- the current frontend is a public/demo surface, not an authenticated SaaS shell;
- browser authentication/session architecture, role-aware navigation and WCAG
  browser/screen-reader evidence remain incomplete;
- external consumers, semantic applicability review, Terraform, secrets, SLOs,
  staging, restore/rollback and incident drills remain incomplete.

## Ready work

1. `WS09-PROCEDURE-TRAINING-001` — beautiful, accessible, read-only procedure
   training preview with explicit evidence/gaps and no fake browser auth.
2. `WS06-CASE-LIFECYCLE-001` — server-side procedure cases and case/document validation.
3. `WS09-AUTH-SHELL-001` — select and implement human SaaS authentication/BFF
   after IdP, tenancy and session decisions are approved.
4. `WS04-RETRIEVAL-EVAL-001` — authorized vector retrieval and real-corpus quality.
5. `WS02-CORPUS-ACQUISITION-001` — official Antigua/comparative corpus.
6. `WS10-PLATFORM-001` — Terraform, observability, restore, load/HA and staging.

## Exact resume condition

Verify workspace/exec/Git/remote SHA; read policy and program files; confirm
Backend CI run `29861888791` and check `88740409681` remain successful for
`66b41b943242d9c4317d35f125de1cd617ebb6e4`; inspect PR state; never retry a
reported push failure before checking the remote ref; do not merge/deploy
automatically; preserve the EvidenceGap privacy/resolution/consumer limitations;
claim the highest-value ready slice with exclusive ownership and repeat producer
→ critic → repair → verifier.
