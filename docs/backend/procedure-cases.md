# Procedure cases v1

`ProcedureCase` is the tenant-scoped operational record that follows a governed,
approved procedure workflow. It is intentionally conservative: workflow approval
is required, but neither workflow approval nor case completion is a legal or
institutional conclusion.

## Endpoints

```text
POST  /api/v1/procedure-cases
GET   /api/v1/procedure-cases/:case_id
PATCH /api/v1/procedure-cases/:case_id
```

Mutations use one action at a time and an `expected_revision`. Supported actions
are step state, document reference, blocker add/resolve, follow-up, documentary
validation state, operational note and operational closure.

## Roles

- `viewer` and other roles with `case:read` may read a tenant case.
- `case_operator` and roles with `case:write` may create and operate cases.
- documentary `validation_state` changes require `procedure:review`.

All checks are server-side. Tenant identity comes from the authenticated
credential and must equal the request contract.

## Evidence dossier

`received` or `reviewed` requires a tenant-owned `document_version_id`. An opaque
request value does not prove receipt or review. The dossier stores references,
not signed URLs or file bodies.

## Replay

Create requests are canonically hashed and serialized by tenant and principal.
The case stores an immutable, hash-bound initial acknowledgement. Consequently,
the same canonical request converges across keys and concurrent calls, and exact
replay remains available if a transport replay row is corrupt.

## Audit and privacy

Case events are append-only. Audit event details record action type and bounded
identifiers; raw operational notes and blocker descriptions are not copied into
the audit stream. The case tables may still contain operational text, so
production requires an approved privacy purpose, retention and deletion/legal-
hold policy.
