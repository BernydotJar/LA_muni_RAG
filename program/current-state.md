# LA Muni RAG — Current Program State

Updated: 2026-07-21T17:58:29Z

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
branch: feature/procedure-assessment-v1
functional_head: 56b9866988f080c10fafe1542038410e3b3f3e9d
remote_feature_ref: 56b9866988f080c10fafe1542038410e3b3f3e9d
origin_main: 4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
worktree: clean
pushed: true
PR_open: false
merged: false
deployed: false
remote_ci_run: 29855067232
remote_ci_status_at_checkpoint: completed_success
```

The workspace control plane still carries stale `error` metadata, but container,
exec, filesystem, Git, PostgreSQL, pgvector, tests and publication work. The
dedicated push helper again reported Docker/NAT failure after the remote branch
advanced; `git ls-remote`, not connector prose, is the publication receipt.

## Feature 061 — conservative ProcedureAssessment v1

```text
56b9866988f080c10fafe1542038410e3b3f3e9d  feat: add conservative procedure assessment v1
```

Implemented and verified:

- `POST /api/v1/procedure-queries` supports three explicit outputs:
  `EvidenceBundle`, draft `ProcedureWorkflow`, and conservative
  `ProcedureAssessment`;
- assessment uses the same authenticated, tenant-scoped compilation,
  idempotency, rate-limit, audit, CORS and response-size boundaries;
- the canonical intermediate workflow is schema-validated before assessment;
- caller-owned opaque `provided_documents` never enter
  `completed_requirements`;
- citations may prove a requirement exists but keep case satisfaction at
  `inferred_for_review` or weaker;
- missing documents and unsupported evidence produce blocked steps, unknowns,
  limitations and one bounded next documentary action;
- exact replay returns identical bytes; corrupt assessment replay is invalidated
  without marker leakage;
- the response contract requires narrative `facts=[]` and `constraints=[]`, so
  idempotency replay cannot become implicit case-note storage;
- no campaign strategy, territory, content production, legal compliance,
  approval, budget, procurement or execution conclusion is returned.

## Verification

A detached checkout at `56b9866988f080c10fafe1542038410e3b3f3e9d` used a real `npm ci --ignore-scripts
--prefer-offline` install.

```text
typecheck: pass
build: pass
contracts: 16 schemas / 16 examples / OpenAPI 3.1.1
EVAL-PROCEDURE-ASSESSMENT-001: 4/4
EVAL-OS-INTEGRATION-001: 5/5
procedure-query API + contracts + operations suites: 50/50
global suite: 654 total / 652 pass / 0 fail / 2 explicit environment skips
source inventory: 17 valid / 4 verified / 1 acquired / 0 ingested
domain evaluation: 8/8
Pages: pass
npm audit --audit-level=high: 0 vulnerabilities
git diff --check: pass
```

Disposable PostgreSQL 15.18 / pgvector 0.8.5 evidence:

```text
procedure-query non-owner SQL gate: pass
ClaimPack SQL gate: pass
workflow lifecycle SQL gate: pass
compiled ProcedureQuery smoke: assessment success + exact replay
compiled ClaimPack smoke: pass
compiled workflow lifecycle smoke: pass
```

## Named eval status

Passing named families now include:

```text
PROCEDURE 4/4; WATER 4/4; MIXCO 4/4; OS-INTEGRATION 5/5;
PROCEDURE-ASSESSMENT 4/4; CONTENT-INTEGRATION 7/7; CONFLICT 8/8;
BOUNDARY 4/4; TENANT 4/4; CORRUPT 20/20; ARTIFACT 5/5;
VECTOR 9/9; JOB-LEASE 13/13.
```

Still missing as dedicated scope-equivalent gates:

```text
EVAL-SOURCE-001; EVAL-MISSING-001; EVAL-RBAC-001; EVAL-INGEST-001;
EVAL-CASE-001; EVAL-ACCESSIBILITY-001; EVAL-RESTORE-001.
```

Partial coverage elsewhere is not promoted to a passing named gate.

## Resolved Feature 061 findings

1. Critical: consumer-supplied document IDs could be mistaken for completed requirements.
2. High: evidence that a requirement exists could be mistaken for case satisfaction.
3. High: assessment replay required its own schema/tenant/corruption regression.
4. High: assessment replay could have persisted narrative facts and constraints.
5. High: a valid-looking assessment could have hidden an invalid intermediate workflow.

No critical/high finding remains open inside Feature 061. This statement does not
apply to the global program.

## Global gaps

- minimum Antigua-first and comparative corpus is incomplete; zero documents are
  credited as ingested;
- no production object store, scanner/definitions monitor, dispatcher, quotas,
  cancellation, dead-letter UI, observability, load or HA;
- procedure queries do not consume evaluated tenant-vector retrieval;
- source/document/search/dedicated EvidenceBundle/EvidenceGap/procedure catalog
  and case APIs remain incomplete;
- ProcedureAssessment is draft-bound and intentionally has zero completed
  requirements until a case/document validation service exists;
- procedure cases remain browser-local;
- authenticated UI and WCAG evidence are incomplete;
- external consumers, semantic applicability review, Terraform, secrets, SLOs,
  staging, restore/rollback and incident drills remain incomplete.

## Ready work

1. `WS08-EVIDENCE-GAP-001` — persistent EvidenceGapRequest provider/API.
2. `WS06-CASE-LIFECYCLE-001` — server-side procedure cases and case/document validation.
3. `WS04-RETRIEVAL-EVAL-001` — authorized vector retrieval and real-corpus quality.
4. `WS02-CORPUS-ACQUISITION-001` — official Antigua/comparative corpus.
5. `WS09-WORKFLOW-UI-001` — authenticated accessible review/approval UI.
6. `WS10-PLATFORM-001` — Terraform, observability, restore, load/HA and staging.

## Exact resume condition

Verify workspace/exec/Git/remote SHA; read policy and program files; confirm successful Backend CI run `29855067232` and inspect PR state for `56b9866988f080c10fafe1542038410e3b3f3e9d`; never retry a reported push
failure before checking the remote ref; do not merge/deploy automatically;
claim the highest-value ready slice with exclusive ownership and repeat
producer → critic → repair → verifier.
