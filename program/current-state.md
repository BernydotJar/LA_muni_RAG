# LA Muni RAG — Current Program State

Updated: 2026-07-21T17:28:04Z

Program status: **PARTIAL — active implementation; global production readiness is not proven**

## Policy and checkout

`AGENTS.md` is authoritative. Feature-branch edits, tests, disposable databases,
commits, pushes, remote-SHA verification, and draft PR creation are authorized.
Protected merge, production deployment, force-push, destructive migration,
spending, external infrastructure, package publication, and legal conclusions
remain human-gated.

```text
workspace_id: 601929eb-4bf6-4900-8170-c15bf3a11ea0
root: /workspace
branch: feature/artifact-vector-runtime-hardening-v1
functional_head: f539db3aa910dbf57328602daf19fec2ed3e9677
remote_feature_ref: f539db3aa910dbf57328602daf19fec2ed3e9677
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
worktree: clean
pushed: true
PR_open: false
merged: false
deployed: false
remote_ci_run: 29852618726
remote_ci_status_at_checkpoint: completed_success
```

The workspace control plane still reports stale `error` metadata, but container,
exec, filesystem, Git, PostgreSQL, pgvector, tests and publication work. The
connector again reported Docker/NAT failure after the remote branch advanced;
`git ls-remote`, not connector prose, is the publication receipt.

## Feature 060 — artifact, lease and vector runtime hardening

```text
f539db3aa910dbf57328602daf19fec2ed3e9677  feat: harden artifact vector runtime boundary
```

Implemented and verified:

- migration 011 stops over accepted history whose scan does not prove exact
  bytes/current generation/clean verdict/MIME or exceeds a seven-day window;
- accepted artifact identity is immutable and scan evidence append-only;
- lookup and lease acquisition repeat exact acceptance predicates;
- final publication uses a tenant-bound, fixed-search-path, PUBLIC-revoked
  `SECURITY DEFINER` boolean lock boundary;
- the runtime has no artifact-object or scan `UPDATE` privilege;
- fresh and supported-legacy migration paths converge;
- corrupt historical acceptance fails and migration rollback is complete;
- vector replacement remains tenant/model/dimension scoped, atomic, bounded and
  stale-chunk removing;
- jobs retain digest-only idempotency, `SKIP LOCKED`, leases, heartbeat, fencing,
  bounded retry, crash recovery and atomic completion.

## Independent verification

A detached checkout at `f539db3aa910dbf57328602daf19fec2ed3e9677` used `npm ci --ignore-scripts --prefer-offline`.
A first symlink-based verifier altered the PDF worker filesystem permission
boundary and caused three false failures; a real lockfile install restored the
intended isolation and all focused/global tests passed.

```text
typecheck: pass
build: pass
contracts: 16 schemas / 16 examples / OpenAPI 3.1.1
EVAL-ARTIFACT-001: 5/5
EVAL-VECTOR-001: 9/9
EVAL-JOB-LEASE-001: 13/13
global suite: 648 total / 646 pass / 0 fail / 2 explicit environment skips
source inventory: 17 valid / 4 verified / 1 acquired / 0 ingested
domain evaluation: 8/8
Pages: pass
npm audit --audit-level=high: 0 vulnerabilities
git diff --check: pass
```

Disposable PostgreSQL 15.18 / pgvector 0.8.5:

```text
fresh 001..007 + database migration 011: pass
non-owner/NOSUPERUSER/NOBYPASSRLS gate: pass
artifact/vector privilege and rejection gate: pass
compiled tenant-ingestion smoke: pass
compiled ingestion-API smoke: pass
corrupt historical acceptance: expected failure + rollback
supported legacy vector path: pass
```

The smoke observed 50 identical submissions converging to one job, two claimers
producing one lease, stale-worker fencing, cross-tenant equal chunk IDs,
rollback to zero vectors, and stale-chunk removal.

## Evals

Passing named families:

```text
PROCEDURE 4/4; WATER 4/4; MIXCO 4/4; OS-INTEGRATION 5/5;
CONTENT-INTEGRATION 7/7; CONFLICT 8/8; BOUNDARY 4/4; TENANT 4/4;
CORRUPT 20/20; ARTIFACT 5/5; VECTOR 9/9; JOB-LEASE 13/13.
```

Still missing as dedicated scope-equivalent gates:

```text
EVAL-SOURCE-001; EVAL-MISSING-001; EVAL-RBAC-001; EVAL-INGEST-001;
EVAL-CASE-001; EVAL-ACCESSIBILITY-001; EVAL-RESTORE-001.
```

Partial coverage elsewhere is not promoted to a passing named gate.

## Resolved slice findings

1. Critical: a wrong-hash clean scan and arbitrary 30-day window could be accepted.
2. High: direct `FOR SHARE` pushed the runtime toward artifact mutation privilege.
3. High: accepted object coordinates/version could change without rescan.
4. High: scan evidence could be edited after acceptance.
5. High: corrupt historical state lacked an automated migration-stop gate.

No critical/high finding remains open inside Feature 060. Global readiness still
has critical/high gaps.

## Global gaps

- incomplete Antigua-first and comparative corpus; zero documents credited ingested;
- no production object store, scanner/definitions monitor, dispatcher, quotas,
  cancellation, dead-letter UI, observability, load or HA;
- procedure queries do not use evaluated tenant-vector retrieval;
- source/document/search/EvidenceBundle/ProcedureAssessment/EvidenceGap/procedure
  catalog/case APIs remain incomplete;
- procedure cases remain browser-local;
- authenticated UI and WCAG evidence are incomplete;
- external consumers, semantic applicability review, Terraform, secrets, SLOs,
  staging, restore/rollback and incident drills remain incomplete.

## Ready work

1. WS08-PROCEDURE-ASSESSMENT-001 — ProcedureAssessment and EvidenceGap APIs.
2. WS06-CASE-LIFECYCLE-001 — server-side procedure cases.
3. WS04-RETRIEVAL-EVAL-001 — authorized vector retrieval and real-corpus quality.
4. WS02-CORPUS-ACQUISITION-001 — official Antigua/comparative corpus.
5. WS09-WORKFLOW-UI-001 — authenticated accessible review/approval UI.
6. WS10-PLATFORM-001 — Terraform, observability, restore, load/HA and staging.

## Exact resume condition

Verify workspace/exec/Git/remote SHA; read policy and program files; confirm successful CI run `29852618726` and inspect PR state; never retry a reported push failure before checking the
remote ref; do not merge/deploy automatically; claim the highest-value ready
slice with exclusive ownership and repeat producer → critic → repair → verifier.
