# Decision 059 — Governed Workflow Lifecycle API v1

Date: 2026-07-21

Status: accepted for local implementation; human merge/deployment review required.

## Context

Feature 058 established deterministic lifecycle and PostgreSQL invariants, but no
versioned HTTP boundary existed for authors, reviewers, approvers, viewers, or
adjacent products. Updating lifecycle columns directly would bypass request
validation, action-specific RBAC, idempotency, bounded audit, and non-enumerating
tenant behavior.

## Decision

Expose four v1 routes backed by one repository interface and the Feature 058 state
machine. Use the same authenticated principal, transaction-local tenant context,
ApiError contract, strict Ajv registry, and CORS boundary as existing v1 APIs.

Mutations use digest-only idempotency. Exact completed bytes are replayed only
after response-schema, tenant, request, and audit identity validation. A corrupt
completed replay is invalidated and audited in a committed transaction before the
handler emits a generic error. A caller that only observes another request's
`processing` claim must not release that claim.

The application and PostgreSQL both enforce draft initialization, transition
validity, separation of duties, append-only governance evidence, approved-content
immutability, and one approved version. Supersession is one transaction: lock a
reviewed same-procedure replacement, supersede the current approved row, append
replacement approval evidence, then approve the replacement.

## Consequences

- AI output remains a draft even when persisted through HTTP.
- Submit and review are separate actions with separate permissions.
- Cross-tenant IDs cannot be enumerated through response status or body details.
- Provider retries can converge without storing raw keys or tokens.
- A shared in-memory repository supports deterministic adversarial HTTP tests; the
  Postgres repository remains the production-shaped implementation.
- OpenAPI and schema registry become release gates for all lifecycle routes.

## Rejected alternatives

- One generic `PATCH /workflows/:id`: rejected because action authorization,
  transition intent, and audit semantics would be ambiguous.
- Frontend-only review state: rejected because it is bypassable.
- Caller-selected approved status: rejected because generation is not human approval.
- Releasing every idempotency reservation on error: rejected because it can delete
  a concurrent request's active claim.
- Invalidating corrupt replay and throwing in one transaction callback: rejected
  because rollback would restore the corrupt replay.
- Sharing procedure tables with OS Electoral or Content Agency: rejected because
  LA Muni RAG owns the authoritative workflow lifecycle.

## Limitations

The API does not determine legal applicability, resolve documentary conflicts,
provide review UI, operate production identity/platform services, or prove
backup/restore/load/deployment readiness. Those remain independent gates.
