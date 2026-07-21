# Decision 058 — Governed Workflow Lifecycle

Date: 2026-07-21

Status: accepted for local implementation; human merge review required

## Context

The existing Procedure Workflow Advisor composes evidence-backed workflow JSON,
but generated workflows were not persisted as governed versions. The production
goal requires explicit draft, review, approval, supersession, archival, versioning,
audit, and human checkpoints. Treating a generated JSON response as an approved
procedure would violate the evidence-first boundary.

## Decision

Use a dual enforcement model:

1. A deterministic TypeScript state machine owns application transitions and role
   requirements.
2. PostgreSQL owns tenant isolation, initial-draft enforcement, transition guards,
   immutable approved content, append-only governance evidence, one-approved-version
   uniqueness, and same-procedure supersession.

Every new version starts as `draft`, including human/imported versions. This is
stricter than the minimum AI-only rule and prevents alternate ingestion paths from
bypassing review. Approval requires a latest `recommended_for_approval` review and
three distinct principals: creator, reviewer, approver.

## Consequences

- AI output can be stored without implying authority.
- Review feedback can return a version to draft but never promotes it automatically.
- Approved content is immutable; corrections require a new numbered version.
- A replacement must be approved in the same transaction that supersedes the former
  approved version because a partial unique index permits one approved version.
- Review and approval rows are append-only evidence rather than editable comments.
- API and UI layers must use this service rather than update lifecycle columns directly.

## Rejected alternatives

- Frontend-only statuses: rejected because authorization and invariants would be bypassable.
- Mutable approved rows: rejected because citations and provenance would no longer identify
  a stable procedure version.
- Automatic approval from retrieval confidence or AI evaluation: rejected because evidence
  quality is not institutional authorization.
- Shared tables with OS Electoral or Content Agency: rejected because LA Muni RAG owns
  procedure versions and adjacent products consume versioned references only.

## Limitations

The foundation does not determine legal validity, resolve contradictory sources,
operate a production identity provider, expose APIs, or prove PostgreSQL runtime
behavior in the current sandbox. Those remain separately gated work.
