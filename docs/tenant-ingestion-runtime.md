# Tenant Vector and Ingestion Runtime

Status: local database/runtime core implemented and integration-tested; no
authenticated ingestion API, deployed worker, production scanner/storage, or
deployment exists.

## Operational boundary

The v1 ingestion runtime starts only after a reviewed `rag.document_versions`
row exists for the authenticated tenant and its `content_sha256` matches the
accepted artifact. It does not acquire, scan, parse, or approve source bytes by
itself.

```text
accepted artifact/version
  -> enqueue digest-bound job
  -> claim bounded lease
  -> extract/chunk/embed outside transaction
  -> atomically replace tenant vectors + mark states + audit
  -> eligible public retrieval
```

The current document-library CLI is file-backed and is not wired to this service.
Until an authenticated adapter persists clean scan evidence and supplies the
exact controlled bytes to a worker, operators must not treat these job tables as
authorization to ingest the acquired DMP.

## Database contract

Apply the canonical migrations in order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_initial_rag_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_procedure_feedback.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_identity_tenancy_rbac.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_procedure_query_api.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/005_tenant_ingestion_runtime.sql
```

Do not apply `migrations/011-production-vector-store.sql` on a fresh database.
It is retained only to reproduce/upgrade historical installations that applied
it before migration `003`. Migration `005` refuses to guess ownership for any
NULL-tenant vector rows.

After migration, new vector writes must use contract v1. Forced RLS rejects new
contract-0 rows even for a correctly scoped runtime tenant; historical rows keep
contract 0 only for review/migration and are excluded from v1 retrieval.

The runtime role needs only environment-reviewed privileges and must be a table
non-owner, non-superuser, and non-`BYPASSRLS` role. It needs `SELECT` on active
document identity, `SELECT/UPDATE` on document versions, job/vector mutation, and
sanitized audit insertion. It does not need `UPDATE` on `rag.documents`.

## Worker protocol

The application service is `PostgresIngestionJobService`. A future worker must:

1. call `leaseNext(tenantId, workerId, leaseSeconds)`;
2. use only the leased `documentVersionId`, `artifactSha256`, and exact
   `pipelineConfig`;
3. periodically call `heartbeat` for long bounded work;
4. call `prepareDocumentEmbeddings` before opening the final transaction;
5. call `complete` with the same artifact digest, lease token, and complete
   embedded record set; or call `fail` with an allowlisted stable error code;
6. discard the raw lease token after completion/failure.

The lease duration is 30–900 seconds (default 300), attempts are 1–10 (default
3), retry delay is capped at 900 seconds, chunks at 5,000 per document, embedding
requests and vector-write batches at 64 records, and search at 100 results.
PostgreSQL sets vector `indexed_at`; a worker timestamp is never authoritative.
These are compiled safety ceilings, not capacity targets.

Completion rechecks the active database document, version label, title, stable
document key (`documents.metadata.document_key`, falling back to document UUID),
and artifact digest. Any mismatch rolls back all vector/job/version/audit changes.

## Idempotency and fencing

- raw caller idempotency keys are hashed before persistence;
- the same tenant/principal/key/request is a replay;
- reuse of that key for a different request is a conflict;
- identical tenant work with another key deduplicates while queued, processing,
  or processed;
- worker and lease values are stored only as SHA-256 digests;
- every heartbeat/finalization/failure requires the current unexpired token;
- reclaim increments the attempt and replaces the fencing token.

Do not log raw keys, lease tokens, provider credentials, database URLs, source
text, or exception messages. Persist only stable error/reason codes and bounded
aggregate metrics.

## Vector retrieval

`TenantPgVectorRepository` requires one transaction-bound client and explicit
tenant/provider/model/dimension scope. Public search joins the exact document
version and successful ingestion job and excludes inactive, non-public,
uncitable, legacy-contract, or mismatched-model rows.

The runtime does not automatically create a vector repository from
`DATABASE_URL`. Health is `degraded` with `tenant_vector_context_required` until
an authenticated request injects a tenant-bound repository. Procedure-query v1
currently remains keyword/phrase-only; vector retrieval needs a separate
authorization and evaluation slice.

Search is exact because a global approximate index can lose recall after tenant
filtering. Before adding an approximate index, capture tenant-partitioned recall,
query plans, statement-timeout behavior, concurrency/load, and side-channel
review.

## Local verification

The guarded SQL fixture accepts only the exact disposable database name
`la_muni_rag_ingestion_test`:

```bash
psql "$DISPOSABLE_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -f db/tests/tenant_ingestion_runtime_gate.sql
npm run build
DATABASE_URL="$DISPOSABLE_RUNTIME_URL" npm run smoke:tenant-ingestion
```

Use only generated disposable credentials and destroy the database/role after
the run. The gate is destructive to its named fixture and is not a production
migration runner. Passing locally does not prove production grants, topology,
load, backup, or release approval.

## Failure and recovery

- `ingestion_lease_rejected`: stop using the token; another worker may own the
  job or its lease expired.
- `ingestion_artifact_identity_mismatch`: do not retry with different bytes;
  reconcile the accepted document version and create reviewed work.
- provider/runtime transient error: call `fail(... retryable: true)` and let the
  bounded schedule decide whether attempts remain.
- malformed/extraction/policy error: use a stable non-retryable code and preserve
  source safety evidence outside job text.
- finalization error: the transaction rolls back vectors, job/version state, and
  audit together; never patch individual rows manually.
- suspected cross-tenant or corrupted state: stop jobs/traffic and follow the
  incident and forward-correction runbooks.

Decisions, risks, and evidence mapping are recorded in the
[Feature 056 decision log](decisions/056-tenant-vector-ingestion-runtime.md),
[risk register](risks/056-tenant-vector-ingestion-risk-register.md), and
[traceability matrix](traceability/056-requirements-traceability.md).
