# PostgreSQL Setup

Last updated: 2026-07-18

Owner: Product Engineering

Status: implementation guide; production role grants and live RLS verification remain required

## Objective

Create the PostgreSQL evidence ledger with versioned documents, citable
sections, tenant ownership, identity, RBAC, audit, and row-level isolation.

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
```

Deployments using the standalone `rag.embedding_vectors` table must apply
`migrations/011-production-vector-store.sql` before migration `003`. Migration
`003` hardens that table only when it already exists.

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
- run tenant-owned work through `withTenantTransaction`, which sets
  `app.tenant_id` transaction-locally.

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
6. confirm denial audit records contain no credential, body, or query text;
7. record PostgreSQL and pgvector versions plus the executed evidence.

This gate remains unproven until it runs against a production-shaped database
and role topology.

## Evidence ledger rationale

The model may draft language, but PostgreSQL must preserve which document and
version were used, which section was cited, what retrieval produced the result,
which tenant owned it, and what human approval state applied. That is why the
schema separates source identity, versions, citable sections, embeddings,
agent runs, citations, and audit events.
