# Tenant Isolation Foundation

Status: implemented for procedure-query, EvidenceGapRequest, ClaimPack,
ingestion-job and workflow lifecycle v1 slices plus the durable ingestion/vector
core; deployed worker/storage/scanner wiring and broader API migration pending.

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

Migration `005_tenant_ingestion_runtime.sql` is now the canonical creator and
hardener for `rag.embedding_vectors`. Fresh databases do not apply the standalone
`migrations/011-production-vector-store.sql`. Historical databases that applied
`011` before `003` converge through `005`; unscoped rows from an unsafe order
halt migration until an explicit reviewed tenant mapping exists.

## Row-level security

`identity.current_tenant_id()` reads `app.tenant_id`. Missing, malformed, or
transaction-expired values return `NULL`; every tenant policy then denies access.

`ENABLE ROW LEVEL SECURITY` plus `FORCE ROW LEVEL SECURITY` is applied to:

- `rag.municipalities`, `rag.documents`, versions, sections, embeddings, and
  ingestion jobs;
- agent conversations, messages, runs, retrieval events/results, citations, and
  procedure feedback;
- `audit.events`;
- `rag.embedding_vectors` (created or converged by migration `005`).
- `integration.ingestion_api_rate_limits` (created by migration `006`);
- `rag.evidence_gap_requests`, `integration.evidence_gap_idempotency`, and
  `integration.evidence_gap_rate_limits` (created by migration `012`).

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

`PostgresIngestionJobService` uses the same contract for enqueue, claim,
heartbeat, completion, retry/failure, vector replacement, document-version
state, and audit. `TenantPgVectorRepository` receives the transaction client and
repeats tenant predicates on every write/read in addition to RLS. A rollback
failure destroys the pooled connection instead of returning a potentially
session-poisoned client.

Direct vector indexing no longer constructs a global repository from
`DATABASE_URL`. Runtime vector readiness requires a repository already closed
over an authenticated tenant transaction and otherwise reports
`tenant_vector_context_required`.

`POST /api/v1/procedure-queries`, `POST /api/v1/evidence-gap-requests`, and
`POST /api/v1/claim-packs` authenticate before body parsing, verify
`integration:query`, match credential provenance and body tenant, and perform
rate/idempotency state and tenant audit through this contract. EvidenceGap adds
an immutable tenant-owned aggregate without retrieval; ProcedureQuery and
ClaimPack retain their scoped retrieval behavior. ClaimPack uses dedicated migration-008 tables rather than sharing
procedure-query keys or response state. Its
keyword/phrase SQL repeats explicit tenant predicates and admits only public,
active documents with processed versions. Calls on the single transaction-bound
`pg` client are serialized.

`POST /api/v1/ingestion-jobs` and scoped `GET` status authenticate and rate-limit
before any POST body parse, require `document:ingest`, and bind every service
call to the credential tenant. The POST body tenant must match, while GET never
uses a caller-supplied tenant. The durable service independently repeats tenant
predicates and version/hash identity checks. Missing and cross-tenant job IDs
share a uniform 404. The callable worker can lease only one explicitly configured
tenant at a time and resolves artifacts by the leased tenant/version/digest
tuple; there is no global storage resolver.

Migration `006` forces RLS on per-principal ingestion API rate state. Migration
`008` separately forces RLS on ClaimPack replay/rate state and creates its own
fixed-search-path authentication-failure aggregate. Anonymous failures remain
tenantless because assigning them to a tenant would invent identity. The
application role cannot read either aggregate table.

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
creation. The guarded disposable procedure-query and ingestion gates ran the
canonical migration order on PostgreSQL 16.14/pgvector 0.8.5 with table-non-owner
roles without `BYPASSRLS`. They proved tenant A/B visibility/write isolation,
missing/malformed context denial, scoped uniqueness, authentication, sanitized
audit, cross-tenant equal vector ids, concurrent job/work deduplication, one
lease winner, stale/artifact fencing, atomic vector rollback/replacement, and
eligible public retrieval. The compiled procedure handler, ingestion service,
and ingestion HTTP handler ran over real non-owner connections. ClaimPack and EvidenceGap have dedicated SQL gates and compiled HTTP smokes wired
to CI. The local EvidenceGap gate ran on PostgreSQL 15.18/pgvector 0.8.5 and
proved A/B isolation, response hashes, aggregate inmutability and non-owner
execution; its HEAD still requires remote CI. The latter also
proved viewer/tenant denial, stable replay/dedup, rate state, own/cross-tenant
status parity, and exact CORS without exposing artifact/control secrets.

This evidence is local and disposable. Production role provisioning and
startup/continuous role attestation, credential rotation, statement limits,
HA/connection policy, staging/load repetition, deployed worker/storage/scanner
wiring, and the remaining endpoint catalog are still release gates. Pre-v1
routes use global queries and remain development-only; production disables them
before wildcard CORS.
