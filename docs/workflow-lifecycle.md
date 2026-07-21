# Governed Procedure Workflow Lifecycle

Feature 058 establishes the publication boundary for procedure workflows.

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

## Local verification

```bash
npm run typecheck
node --import tsx --test \
  src/__tests__/workflow-lifecycle-state-machine.test.ts \
  src/__tests__/workflow-lifecycle-migration.test.ts
git diff --check
```

## Not yet credited

- authenticated lifecycle API endpoints;
- non-owner PostgreSQL execution of migration 009;
- lifecycle audit events in `audit.events`;
- review/approval UI and accessibility;
- concurrency, backup/restore, staging, and deployment evidence.
