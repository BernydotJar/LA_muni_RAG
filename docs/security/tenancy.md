# Tenant Isolation Foundation

Status: implemented and wired for procedure-query v1; broader API migration pending.

## Boundary

Every authenticated credential resolves to one UUID `tenant_id`. Request bodies,
query parameters, `Host`, and forwarded headers are not sources of tenant truth.
When an endpoint includes `tenant_id` in its contract, the value must match
the authenticated principal through `requireTenantMatch` before any repository
call.

`platform_admin` is not a tenant-isolation bypass. Cross-tenant administration
requires an explicit future control-plane design and is outside this foundation.

## Data model

Migration `db/migrations/003_identity_tenancy_rbac.sql` creates:

- `identity.tenants`;
- tenant-bound `identity.principals`;
- `identity.memberships` with the ten application roles;
- `identity.api_credentials`, which stores only a 32-byte SHA-256 digest.

Top-level `tenant_id UUID NOT NULL` ownership is added to the principal RAG,
agent, feedback, and audit tables. Composite foreign keys keep child records in
the same tenant as their parent. Tenant-leading indexes support policy-filtered
access.

Deterministic or user-selected identities are tenant-scoped as well. Municipality
slugs, document-version labels, content hashes, and standalone vector chunk IDs
no longer use a global uniqueness boundary. This permits two tenants to own the
same public source bytes and prevents unique-constraint behavior from becoming
a cross-tenant metadata oracle.

### Legacy bootstrap tenant

Existing rows are assigned explicitly to:

```text
00000000-0000-4000-8000-000000000001
legacy-bootstrap
```

This is a migration bridge, not a default for new data. Operators must inventory
and reassign legacy records before onboarding more than one tenant. New writes
must always provide the authenticated tenant UUID.

The standalone vector migration `migrations/011-production-vector-store.sql`
must run before migration `003` in deployments that use `rag.embedding_vectors`.
Migration `003` conditionally hardens that table when it exists; applying the
legacy vector migration afterward would create an unscoped table and is not a
supported production order.

## Row-level security

`identity.current_tenant_id()` reads `app.tenant_id`. Missing, malformed, or
transaction-expired values return `NULL`; every tenant policy then denies access.

`ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY` is applied to:

- `rag.municipalities`, `rag.documents`, versions, sections, embeddings, and
  ingestion jobs;
- agent conversations, messages, runs, retrieval events/results, citations, and
  procedure feedback;
- `audit.events`;
- `rag.embedding_vectors` when it already exists.

Each policy applies the same predicate to reads and writes:

```sql
tenant_id = identity.current_tenant_id()
```

Identity tables also have tenant policies. They are deliberately not `FORCE`d:
the tightly scoped `SECURITY DEFINER` authentication function must perform one
pre-tenant digest lookup as the migration owner. Direct public table access and
public execution of that authentication function are revoked. Its `search_path`
is fixed and it returns only credential, tenant, principal, and role identifiers.

## Application transaction contract

All tenant-owned database work must use one transaction and a transaction-local
setting. The shared helper `withTenantTransaction` performs the required order:

```sql
BEGIN;
SELECT set_config('app.tenant_id', $1, true);
-- tenant-owned statements
COMMIT;
```

The third `set_config` argument must remain `true`. Session-level tenant settings
can leak across pooled requests and are prohibited. Repository work outside this
transaction fails closed under RLS.

`POST /api/v1/procedure-queries` authenticates before body parsing, verifies
`integration:query`, matches the credential and body tenant, and performs
retrieval, rate/idempotency state, and tenant audit through this contract. Its
keyword/phrase SQL repeats explicit tenant predicates and admits only public,
active documents with processed versions. Calls on the single transaction-bound
`pg` client are serialized.

The runtime PostgreSQL role must:

- be distinct from the migration/table owner;
- not have `BYPASSRLS` and not be a superuser;
- receive only required schema/table privileges;
- receive `EXECUTE` on
  `identity.authenticate_api_credential(bytea)` through deployment-specific
  grants to the already managed runtime role.

This migration intentionally does not create or alter a PostgreSQL login role.
Table owners normally bypass RLS unless `FORCE` is active, and `BYPASSRLS` roles
always bypass it; either property on the application connection invalidates the
isolation guarantee.

## Verification and release boundary

Static adversarial tests verify the backfill, top-level ownership, fixed function
search paths, default-deny policies, `FORCE` coverage, and absence of managed-role
creation. The guarded disposable gate in
`db/tests/procedure_query_runtime_gate.sql` additionally ran the full migration
order on PostgreSQL 16.14/pgvector 0.8.5, used a non-owner role without
`BYPASSRLS`, and proved tenant A/B visibility/write isolation, missing/malformed
context denial, scoped uniqueness, authentication, and sanitized aggregate audit.
The compiled v1 handler then passed success/replay/conflict/tenant-denial/
boundary/401/corrupt-replay/retry over that connection.

This evidence is local and disposable. Production role provisioning, credential
rotation, HA/connection policy, staging repetition, and the remaining endpoint
catalog are still release gates. Pre-v1 routes use global queries and remain
development-only; production disables them before wildcard CORS.
