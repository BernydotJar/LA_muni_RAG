# Identity and RBAC Foundation

Status: implemented and enforced by procedure-query v1 and ingestion-job v1;
broader API migration pending.

## Authentication

The application accepts an opaque Bearer credential between 32 and 512 ASCII
characters, with an authorization-header ceiling of 640 characters. Missing,
malformed, oversized, expired, revoked, unknown, and role-less credentials must
all produce the same external v1 `ApiError`: HTTP 401 with
`error.code = "unauthorized"`, `error.message = "Authentication required"`,
tenant/credential `null`, and no rejection detail.

Generate credentials from at least 256 bits of cryptographically secure random
data. The raw value is shown only at provisioning time. Before repository access,
Node hashes it with SHA-256. PostgreSQL stores only the resulting 32-byte digest
in `identity.api_credentials.secret_sha256`; raw credentials must never enter
database rows, logs, audit details, traces, URLs, source files, or browser assets.

SHA-256 is suitable here only because credentials are high-entropy random values,
not user-selected passwords. Rotation creates a new digest and revokes the old
credential. Expiration and revocation are enforced inside the fixed-search-path
`SECURITY DEFINER` lookup function.

## Roles

The exact application roles are:

1. `platform_admin`
2. `tenant_admin`
3. `document_manager`
4. `researcher`
5. `procedure_author`
6. `procedure_reviewer`
7. `procedure_approver`
8. `case_operator`
9. `viewer`
10. `integration_client`

They are application roles stored in `identity.memberships`; they are not
PostgreSQL login roles.

## Explicit permission map

| Role | Permissions |
|---|---|
| `platform_admin` | every permission listed below, within the credential tenant |
| `tenant_admin` | `tenant:manage`, `identity:manage`, `source:read`, `source:write`, `document:read`, `document:write`, `document:ingest`, `evidence:query`, `procedure:read`, `procedure:draft`, `procedure:review`, `case:read`, `case:write`, `audit:read` |
| `document_manager` | `source:read`, `source:write`, `document:read`, `document:write`, `document:ingest`, `evidence:query`, `procedure:read` |
| `researcher` | `source:read`, `document:read`, `evidence:query`, `procedure:read`, `case:read` |
| `procedure_author` | `source:read`, `document:read`, `evidence:query`, `procedure:read`, `procedure:draft` |
| `procedure_reviewer` | `source:read`, `document:read`, `evidence:query`, `procedure:read`, `procedure:review` |
| `procedure_approver` | `source:read`, `document:read`, `evidence:query`, `procedure:read`, `procedure:approve` |
| `case_operator` | `document:read`, `evidence:query`, `procedure:read`, `case:read`, `case:write` |
| `viewer` | `source:read`, `document:read`, `evidence:query`, `procedure:read`, `case:read` |
| `integration_client` | `source:read`, `document:read`, `evidence:query`, `procedure:read`, `integration:query` |

The complete permission vocabulary is:

```text
platform:admin
tenant:manage
identity:manage
source:read
source:write
document:read
document:write
document:ingest
evidence:query
procedure:read
procedure:draft
procedure:review
procedure:approve
case:read
case:write
audit:read
integration:query
```

Approval remains separated from tenant administration, authoring, and review.
Multiple memberships combine permissions, but never change the credential tenant.

## Enforcement contract

Protected handlers must apply controls in this order:

1. `authenticateBearer` resolves a principal from a credential digest;
2. `requirePermission` checks the endpoint permission;
3. `requireTenantMatch` compares any contracted tenant with the principal tenant;
4. `withTenantTransaction` establishes the RLS context;
5. the repository executes only inside that transaction;
6. the decision is recorded as a sanitized security audit event.

The procedure-query v1 route authenticates before reading body bytes and applies
its per-principal rate gate immediately after authentication, before permission,
header/body validation, replay, or compilation. It then follows the permission,
contracted tenant, transaction, and audit controls above.

The ingestion-job v1 route follows the same pre-body authentication/rate order,
then requires `document:ingest`. `tenant_admin` and `document_manager` have this
permission; `viewer`, `researcher`, and `integration_client` do not. Enqueue
requires the body tenant to match the credential. Status uses only the
credential tenant and returns the same 404 for a missing or cross-tenant job.

Permission denial and tenant mismatch both return the same safe response:

```json
{"error":{"code":"forbidden","message":"Access denied"}}
```

The v1 403 may repeat the caller's already authenticated tenant and credential
correlation IDs, as required by its closed contract. It never includes the
requested foreign tenant, role membership, credential state, object existence,
or policy details.

## Security audit vocabulary

Only these event types are accepted by the security audit builder:

```text
identity.authentication_succeeded
identity.authentication_failed
identity.authorization_allowed
identity.authorization_denied
identity.tenant_access_allowed
identity.tenant_access_denied
```

Outcomes are restricted to `success`, `error`, or `blocked`. Details are an
allowlisted set of bounded `requestId`, route pathname, permission, and reason
code fields. Query strings, headers, request bodies, raw credentials, arbitrary
metadata, and control characters are rejected.

This builder vocabulary remains available for shared identity controls. The
procedure-query route persists its more specific, allowlisted
`integration.procedure_query.*` decisions in tenant-owned `audit.events`; pre-
tenant failures use the separate bounded aggregate
`audit.authentication_failures` sink. Ingestion-job v1 similarly persists
allowlisted `integration.ingestion_job.*` decisions and uses the distinct
tenantless `audit.ingestion_authentication_failures` aggregate. Other protected
endpoints must provide equivalent persistence without weakening the uniform
client response.
