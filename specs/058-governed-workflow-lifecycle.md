# 058 — Governed Workflow Lifecycle Foundation

Status: implemented locally; PostgreSQL runtime gate pending

## Objective

Create the authoritative lifecycle boundary for procedure workflow versions without
publishing, merging, deploying, or treating AI output as official procedure.

## In scope

- tenant-owned procedures and immutable numbered workflow versions;
- lifecycle states `draft`, `in_review`, `approved`, `superseded`, `archived`;
- mandatory draft initial state for AI, human, and imported versions;
- mutable content only while draft;
- append-only review and approval evidence;
- creator/reviewer/approver separation of duties;
- recommended human review before approval;
- one approved version per procedure;
- same-procedure supersession;
- terminal archival;
- forced PostgreSQL RLS and composite tenant foreign keys;
- deterministic TypeScript state machine and migration-shape tests.

## Out of scope

- API handlers, authenticated UI, automatic publication, deployment, notifications;
- semantic conflict resolution or selection of the legally applicable version;
- campaign strategy, field operations, content production, publication tasks;
- automatic approval from feedback, retrieval confidence, AI output, or external systems.

## Invariants

1. Every new version starts `draft`; AI cannot create `in_review` or `approved` records.
2. Draft content cannot be mutated after approval, supersession, or archival.
3. Review requires `in_review`; the creator cannot review the same version.
4. Approval requires the latest review to recommend approval.
5. Creator, reviewer, and approver are distinct principals.
6. Only one approved version exists per tenant/procedure.
7. Supersession names a different version of the same procedure.
8. Review and approval evidence is append-only.
9. All owned tables force RLS and use tenant-composite references.
10. Operational state never proves legal sufficiency or institutional adoption.

## Acceptance evidence

- `src/workflowLifecycle/stateMachine.ts`
- `src/__tests__/workflow-lifecycle-state-machine.test.ts`
- `db/migrations/009_workflow_lifecycle.sql`
- `src/__tests__/workflow-lifecycle-migration.test.ts`
- `npm run typecheck`
- focused tests pass with no skipped case
- `git diff --check`

## Remaining production gates

- apply migrations 001–009 to disposable PostgreSQL/pgvector as a non-owner runtime role;
- add authenticated/idempotent API handlers and contract schemas;
- persist bounded lifecycle audit events;
- add cross-tenant/RBAC HTTP integration tests;
- expose review/approval UI and accessibility tests;
- test backup/restore, conflict/supersession races, load, and remote CI;
- obtain human review before merge or deployment.
