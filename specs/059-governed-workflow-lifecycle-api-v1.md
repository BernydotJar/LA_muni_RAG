# 059 — Governed Workflow Lifecycle API v1

Status: implemented and verified against disposable PostgreSQL locally; remote CI pending.

## Objective

Expose the governed workflow lifecycle from Feature 058 through authenticated,
tenant-scoped, contract-first HTTP APIs without allowing AI or callers to bypass
human review, approval, versioning, or product boundaries.

## In scope

- `POST /api/v1/workflow-drafts`;
- `POST /api/v1/workflow-reviews`;
- `POST /api/v1/workflow-approvals`;
- `GET /api/v1/workflows/{workflow_version_id}`;
- strict JSON Schema 2020-12 requests and responses;
- OpenAPI 3.1.1;
- authentication before body parsing;
- action-specific RBAC;
- tenant/credential/request identity binding;
- forced-RLS PostgreSQL repository;
- digest-only idempotency and exact replay;
- bounded rate limits and audits;
- non-enumerating cross-tenant reads;
- atomic approval of a reviewed replacement while superseding the current approved version;
- deterministic in-memory tests, non-owner SQL gate, and compiled HTTP smoke.

## Out of scope

- automatic publication or deployment;
- legal-validity determination or semantic conflict resolution;
- workflow review/approval UI and notifications;
- direct database access by OS Electoral or Content Agency;
- campaign strategy, voter profiling, content production, or publication tasks.

## Acceptance criteria

1. Every created version is `draft`; AI cannot produce an approved record.
2. Authentication and coarse authorization finish before request-body parsing.
3. Submit, review, approve, supersede, archive, and read use distinct permissions.
4. Creator, reviewer, and approver remain distinct in service and database controls.
5. Request, outer tenant, nested workflow tenant, and credential provenance match the authenticated identity.
6. Missing and cross-tenant workflow IDs return indistinguishable `404` errors.
7. Exact replay returns exact bytes; changed payload conflicts; concurrent processing is not released by another request.
8. Invalid stored replay is committed as invalidated before returning a non-leaking error.
9. Every success and rejection has bounded audit evidence.
10. Supersession promotes only a reviewed same-procedure replacement and leaves exactly one approved version in one transaction.
11. PostgreSQL gates run as a non-owner, non-superuser, non-`BYPASSRLS` role.
12. Contracts, typecheck, build, focused tests, global regression, and diff checks pass.
13. Documentation does not claim merge, deployment, legal sufficiency, or corpus completeness.

## Verification commands

```bash
npm run typecheck
npm run test:workflow-lifecycle
npm run contracts:validate
npm test
npm run build
DATABASE_URL=postgresql://... npm run smoke:workflow-lifecycle
git diff --check
```

## Production limitations

The slice is not production-ready by itself. It still requires remote CI on the
published commit, UI/accessibility, backup/restore, load/HA, observability,
consumer interoperability, conflict resolution, platform selection, and human
approval before protected merge or deployment.
