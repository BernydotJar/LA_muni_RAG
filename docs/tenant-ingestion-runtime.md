# Tenant Vector and Ingestion Runtime

Status: local database/runtime core, authenticated enqueue/status API, and
callable bounded worker are implemented and integration-tested; no deployed
worker, production scanner/storage adapter, or deployment exists.

## Operational boundary

The v1 ingestion runtime starts only after a reviewed `rag.document_versions`
row exists for the authenticated tenant and its `content_sha256` matches the
accepted artifact. It does not acquire, scan, parse, or approve source bytes by
itself.

```text
accepted artifact/version
  -> authenticated API enqueues digest-bound job
  -> claim bounded lease
  -> resolve immutable clean-scan-bound bytes
  -> extract/chunk/embed outside transaction
  -> atomically replace tenant vectors + mark states + audit
  -> eligible public retrieval
```

The current document-library CLI is file-backed and is not wired to this
service. The API accepts only an existing version UUID and matching digest; it
does not accept, locate, upload, scan, or approve bytes. Until an approved
storage adapter persists clean scan evidence and resolves the exact immutable
bytes to a deployed worker, operators must not treat an API `202` or these job
tables as authorization to ingest the acquired DMP.

## Database contract

Apply the canonical migrations in order:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_initial_rag_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_procedure_feedback.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_identity_tenancy_rbac.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_procedure_query_api.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/005_tenant_ingestion_runtime.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_ingestion_api_runtime.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/007_persisted_artifact_acceptance.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/011_artifact_vector_runtime_hardening.sql
```

Do not apply `migrations/011-production-vector-store.sql` on a fresh database.
It is retained only to reproduce/upgrade historical installations that applied
it before migration `003`. Migration `005` refuses to guess ownership for any
NULL-tenant vector rows.

After migration, new vector writes must use contract v1. Forced RLS rejects new
contract-0 rows even for a correctly scoped runtime tenant; historical rows keep
contract 0 only for review/migration and are excluded from v1 retrieval.

Migration `011_artifact_vector_runtime_hardening.sql` is distinct from the
legacy root-level `migrations/011-production-vector-store.sql`. The database
migration stops if an existing accepted object points to the wrong hash,
non-clean or stale-generation scan, mismatched media type, or a window longer
than seven days. A row trigger enforces the same invariant and keeps accepted
object identity plus scan evidence immutable. Lookup and lease repeat the
predicates. Finalization calls a tenant-bound, fixed-search-path
`SECURITY DEFINER` function that validates and row-locks the exact object/scan;
this avoids granting the worker `UPDATE` on acceptance tables.

The runtime role needs only environment-reviewed privileges and must be a table
non-owner, non-superuser, and non-`BYPASSRLS` role. It needs the narrow
credential/auth-failure functions, `SELECT` on active document identity,
`SELECT/UPDATE` on document versions, job/vector/API-rate mutation, and
sanitized audit insertion. It also needs `EXECUTE` only on
`rag.lock_valid_artifact_acceptance_v1(UUID, UUID, UUID, TEXT, UUID)`; it needs
`SELECT`, but not `UPDATE`, on artifact objects/scans. It cannot read the
tenantless authentication-failure table and does not need `UPDATE` on
`rag.documents`.

## Authenticated API boundary

`POST /api/v1/ingestion-jobs` authenticates and rate-limits before parsing,
requires `document:ingest`, matches the body tenant, validates the closed v1
schema, and enqueues only the registered version/hash under the server-owned
`municipal_document_v1` profile. `GET /api/v1/ingestion-jobs/{job_id}` uses the
same permission and tenant scope. Missing and cross-tenant jobs share one 404.

The API returns no artifact digest, provider/model, raw idempotency key, worker,
or lease token. See [Ingestion jobs API v1](api/ingestion-jobs-v1.md) for exact
headers, results, grants, rate/audit behavior, and CORS.

## Worker protocol

The callable `TenantIngestionWorker` composes `PostgresIngestionJobService`, an
embedding provider, and an injected `AcceptedArtifactResolver`. It has no
filesystem, URL, or object-storage default. The resolver must return the exact
leased tenant/version/digest, an immutable object generation, a bounded
basename/media type, private bytes, and current clean evidence bound to those
bytes.

Each `runOnce`:

1. call `leaseNext(tenantId, workerId, leaseSeconds)`;
2. require the leased extractor/provider/model/dimension to match the worker;
3. resolve and verify immutable scope, structure, digest, and current clean scan
   evidence before parser/provider work;
4. heartbeat, parse the private in-memory bytes, and rehash after extraction;
5. call `prepareDocumentEmbeddings` before opening the final transaction;
6. call `complete` with the same artifact digest, lease token, and complete
   embedded record set; or call `fail` with an allowlisted stable error code;
7. discard the raw lease token after completion/failure.

The lease duration is 30–900 seconds (default 300), attempts are 1–10 (default
3), retry delay is capped at 900 seconds, chunks at 5,000 per document, embedding
requests and vector-write batches at 64 records, and search at 100 results.
PostgreSQL sets vector `indexed_at`; a worker timestamp is never authoritative.
These are compiled safety ceilings, not capacity targets.

Completion rechecks the active database document, version label, title, stable
document key (`documents.metadata.document_key`, falling back to document UUID),
and artifact digest. Any mismatch rolls back all vector/job/version/audit changes.

The worker class is not a running service. There is no loop, process entry point,
tenant scheduler, object-store resolver, scanner service, workload identity,
attempt-wide deadline/cancellation, or graceful-shutdown evidence. The public
health response deliberately reports `workerConfigured: false`.

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
psql "$DISPOSABLE_ADMIN_URL" -v ON_ERROR_STOP=1 \
  -f db/tests/artifact_vector_runtime_hardening_gate.sql
npm run build
DATABASE_URL="$DISPOSABLE_RUNTIME_URL" npm run smoke:tenant-ingestion
DATABASE_URL="$DISPOSABLE_RUNTIME_URL" npm run smoke:ingestion-api
```

Use only generated disposable credentials and destroy the database/role after
the run. The gate is destructive to its named fixture and is not a production
migration runner. Passing locally does not prove production grants, topology,
load, backup, or release approval.

The historical 2026-07-19 gate applied fresh `001..006` and supported
legacy vector-store chains. On 2026-07-21, a fresh PostgreSQL 15.18/pgvector
0.8.5 database applied `001..007` plus database migration 011, both non-owner
SQL gates, and both compiled ingestion smokes. The hardening gate rejected a
wrong-hash clean scan, stale generation, oversized acceptance window, accepted
identity mutation, and scan update. The compiled HTTP smoke covered
authentication, permission/tenant denial,
new/replay/dedup/conflict, rate limiting, scoped status/404, exact CORS, and
secret minimization. All fixtures were synthetic and every smoke reported zero
controlled artifact reads.

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
[traceability matrix](traceability/056-requirements-traceability.md). The API and
worker extension is recorded in the
[Feature 057 decision log](decisions/057-authenticated-ingestion-api-worker.md),
[risk register](risks/057-authenticated-ingestion-api-worker-risk-register.md),
and [traceability matrix](traceability/057-requirements-traceability.md).
