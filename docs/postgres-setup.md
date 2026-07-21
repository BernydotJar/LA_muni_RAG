# PostgreSQL Setup

Last updated: 2026-07-19

Owner: Product Engineering

Status: implementation guide; production role grants and live RLS verification remain required

## Objective

Create the PostgreSQL evidence ledger with versioned documents, citable
sections, tenant ownership, identity, RBAC, audit, durable ingestion jobs,
tenant-owned vectors, ingestion API rate/auth state, and row-level isolation.

## Prerequisites

- a supported PostgreSQL instance with `pgcrypto` and `pgvector` available;
- a migration connection that owns the application schemas;
- a separate runtime connection that is neither a superuser nor a `BYPASSRLS`
  role and does not own the protected tables;
- `DATABASE_URL` supplied through the local shell or an approved secret manager.

Never put a password, complete connection URL, API credential, or secret-manager
value in this repository, a browser asset, command history, logs, or screenshots.
Use placeholders in documentation and rotate any value that was exposed.

## Create a local database

Create a database named `la_muni_rag` with your normal PostgreSQL administration
tool. The repository does not prescribe or store an administrator password.

Set the migration connection only in the current shell:

```bash
export DATABASE_URL='postgresql://MIGRATION_USER:REDACTED@localhost:5432/la_muni_rag'
```

Do not paste a real value into `.env.example`; a local ignored `.env` may be used
for development only.

## Apply the schema

Apply migrations in this order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_initial_rag_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_procedure_feedback.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_identity_tenancy_rbac.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_procedure_query_api.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/005_tenant_ingestion_runtime.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_ingestion_api_runtime.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/007_persisted_artifact_acceptance.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/008_claim_pack_api.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/009_workflow_lifecycle.sql
```

Migration `005` is the canonical vector-store migration for fresh databases.
Do not apply `migrations/011-production-vector-store.sql` on a fresh install; it
is retained only for historical installations that applied it before migration
`003`. Migration `005` converges that supported legacy order. If an unscoped
standalone table was created after `003` and contains rows, `005` stops for an
explicit reviewed tenant mapping rather than guessing ownership.

Migration `003` creates an explicit bootstrap tenant for existing rows. It does
not create a PostgreSQL login and does not make the bootstrap tenant a runtime
default.

## Load the registry seeds

After migration `003`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seeds/001_core_documents.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/seeds/002_document_versions.sql
```

Both seed transactions set `app.tenant_id` to the documented bootstrap UUID and
write that UUID explicitly. Before onboarding another tenant, inventory and
reassign those rows through an approved migration.

## Runtime role boundary

Use a separately managed runtime role with only the schema/table/function
privileges required by the application. It must:

- not own `identity`, `rag`, `agent`, or `audit` objects;
- not be a superuser and not have `BYPASSRLS`;
- receive `EXECUTE` on
  `identity.authenticate_api_credential(bytea)` explicitly;
- receive `EXECUTE` on the narrow
  `audit.record_ingestion_authentication_failure(uuid, uuid, text)` function,
  without read access to its tenantless aggregate table;
- run tenant-owned work through `withTenantTransaction`, which sets
  `app.tenant_id` transaction-locally;
- use transaction-bound ingestion/vector repositories; it does not need
  `UPDATE` on `rag.documents` for the ingestion v1 flow.

Grant statements are environment-specific and intentionally absent until the
runtime role name and platform are approved. Do not weaken RLS to make a grant
or seed problem disappear.

## Verification gate

Static tests do not prove database isolation. Before any production approval,
execute a database integration gate with the non-owner runtime role:

1. authenticate tenant A and tenant B credentials;
2. insert distinct records under each transaction-local tenant context;
3. prove tenant A cannot read, update, delete, infer, or conflict on tenant B
   records;
4. prove a missing or malformed tenant setting returns no protected rows;
5. prove committed and rolled-back transactions do not leak the setting through
   the connection pool;
6. concurrently submit and lease ingestion work; prove replay/work
   deduplication, lease fencing, atomic rollback/replacement, and cross-tenant
   equal chunk ids;
7. run the compiled authenticated ingestion HTTP surface and prove role/tenant
   denial, new/replay/dedup/conflict, rate limit, own/cross-tenant status, and
   exact CORS;
8. confirm denial/job audit records contain no credential, raw key/token, source
   body, query text, or exception text;
9. record PostgreSQL and pgvector versions plus the executed evidence.

The guarded disposable ingestion gate passed locally on PostgreSQL 16.14 and
pgvector 0.8.5 with a table-non-owner, non-superuser, non-`BYPASSRLS` role. That
is executable local evidence, not proof of production role provisioning,
startup/continuous attestation, populated-data migration timing, HA, load, or
release approval. See [Tenant Vector and Ingestion Runtime](tenant-ingestion-runtime.md).
The compiled API smoke uses only synthetic registered versions and reports zero
controlled artifact reads; it does not prove storage/scanner integration or a
deployed worker. See [Ingestion jobs API v1](api/ingestion-jobs-v1.md).
The complete production-shaped gate remains unproven until those controls run
against the approved staging and production-equivalent role topology.

## Evidence ledger rationale

The model may draft language, but PostgreSQL must preserve which document and
version were used, which section was cited, what retrieval produced the result,
which tenant owned it, and what human approval state applied. That is why the
schema separates source identity, versions, citable sections, embeddings,
agent runs, citations, and audit events.
