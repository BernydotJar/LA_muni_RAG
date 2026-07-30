# Governed Procedure Workflow Lifecycle

Feature 058 establishes the publication boundary for procedure workflows. Feature
059 exposes that boundary through authenticated v1 APIs without changing the
ownership or human-approval model.

## States

```text
draft -> in_review -> approved -> superseded -> archived
  ^         |
  |---------| changes_requested
```

`archived` is terminal. An approved version is immutable. Correcting an approved
workflow requires another numbered draft, a new review, and a distinct approval.

## Human checkpoints

- Author: creates/revises draft and submits it for review.
- Reviewer: requests changes or recommends approval; cannot be the creator.
- Approver: approves after a recommendation; cannot be creator or reviewer.
- Approval status does not prove legal sufficiency, source currency, budget,
  procurement compliance, or institutional execution.

## Database ownership

LA Muni RAG owns:

- `rag.procedures`;
- `rag.procedure_versions`;
- `rag.workflow_reviews`;
- `rag.workflow_approvals`.

OS Electoral and Content Agency receive stable workflow/version references through
versioned APIs. They must not write these tables or maintain independent official
workflow copies.

## API boundary

```text
POST /api/v1/workflow-drafts
POST /api/v1/workflow-reviews
POST /api/v1/workflow-approvals
GET  /api/v1/workflows/{workflow_version_id}
```

Authentication and coarse permission checks run before body parsing. Mutations use
SHA-256-scoped idempotency, exact validated replay, action-specific RBAC, forced
RLS, bounded audit, and server-owned transitions. Missing and cross-tenant IDs use
the same non-enumerating `404` response.

See [Workflow Lifecycle API v1](api/workflow-lifecycle-v1.md).

## Local verification

```bash
npm run typecheck
npm run test:workflow-lifecycle
npm run contracts:validate
npm run build
DATABASE_URL=postgresql://... npm run smoke:workflow-lifecycle
git diff --check
```

## Not yet credited

- remote CI on the published API commit, protected merge, or deployment;
- review/approval UI and accessibility;
- consumer interoperability, semantic conflict resolution, backup/restore,
  concurrency load, staging, HA, and observability evidence.
