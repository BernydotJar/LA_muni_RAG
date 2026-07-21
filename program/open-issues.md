# Open Program Issues

Updated: 2026-07-21T18:00:57Z

## Publication and CI

`feature/procedure-assessment-v1` is published at exact SHA `56b9866988f080c10fafe1542038410e3b3f3e9d`. `origin/main` remains `4950ba3`;
no merge or deployment is claimed. The public GitHub API reports no PR. Backend
CI run `29855067232` and check `88717220160` completed successfully.

The connector again reported Docker/NAT failure although the remote ref advanced.
Always verify remote SHA before retrying.

## Ready product work

### WS08-EVIDENCE-GAP-001
Implement persistent `POST /api/v1/evidence-gap-requests` with auth, RBAC, tenant
binding, validation, idempotency, audit, rate limit, lifecycle, OpenAPI, SQL gate
and consumer contract semantics. It must not allow OS Electoral to declare a
source official.

### WS06-CASE-LIFECYCLE-001
Server system of record for approved procedure version, steps, documents,
blockers, follow-up, dossier, audit and validated requirement completion.

### WS04-RETRIEVAL-EVAL-001
Authorize tenant vector retrieval, complete filters/reranking, and measure recall,
citation fidelity, groundedness and load on real corpus.

### WS02-CORPUS-ACQUISITION-001
Acquire, hash, classify, scan, ingest and retrieve minimum Antigua-first plus
Mixco/Guatemala comparative sources without inventing missing documents.

### WS09-WORKFLOW-UI-001
Authenticated role-aware document/evidence/workflow/case UI with WCAG evidence.

### WS10-PLATFORM-001
Terraform, secrets, observability/SLOs, backup/restore, rollback, load/HA,
staging and incident exercise.

## Missing dedicated evals

`EVAL-SOURCE-001`, `EVAL-MISSING-001`, `EVAL-RBAC-001`, `EVAL-INGEST-001`,
`EVAL-CASE-001`, `EVAL-ACCESSIBILITY-001`, and `EVAL-RESTORE-001`.

## Human/tool gates

- current Cloud Sandbox exposes no authorized PR-creation action;
- protected merge and production deployment;
- external infrastructure/spending/credentials;
- legal applicability conclusions.
