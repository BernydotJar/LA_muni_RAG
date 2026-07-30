# Plan — Tenant procedure case lifecycle v1

## Data

Add tenant-owned case, step, document-reference, blocker and event tables. Bind
cases to `rag.procedure_versions`, require `approved` on insert, force RLS and
make creation identity immutable. Store a canonical request hash and sealed
initial response so replay survives transport-key differences and transport row
corruption.

## Security

Authenticate before parsing. Resolve tenant from the credential. Use `case:read`,
`case:write` and `procedure:review` server-side. Keep pre-tenant authentication
evidence in a bounded write-only sink. Use a non-owner runtime role.

## API

Use closed JSON Schemas and one bounded mutation per PATCH. Require
`Idempotency-Key`, `X-Request-Id`, optimistic revision and exact provenance.
Return uniform not-found behavior across tenant boundaries.

## Verification

1. API TDD with in-memory persistence.
2. Contract/OpenAPI validation.
3. Static migration boundary tests.
4. Disposable PostgreSQL migrations and SQL gate.
5. Compiled HTTP smoke using PostgreSQL runtime credentials.
6. EVAL-CASE-001.
7. Full regression, detached checkout and remote CI.

## Rollback

Feature code is additive. Before production use, application rollback may stop
routing the new API. Database rollback is forward-only: do not drop case data;
apply a reviewed corrective migration. No destructive rollback is automated.
