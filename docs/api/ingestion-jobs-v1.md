# Ingestion jobs API v1

Status: implemented and locally verified for enqueue/status; no upload endpoint,
storage/scanner adapter, running worker, or deployment exists.

## Routes

```http
POST /api/v1/ingestion-jobs
GET  /api/v1/ingestion-jobs/{job_id}
```

The routes operate only on an existing, active, same-tenant
`rag.document_versions` record. They do not accept file bytes, URLs, paths,
titles, scanner results, provider/model choices, or worker controls.
This is not an upload or scanner endpoint.

## Authentication and headers

Both methods require:

- `Authorization: Bearer …` resolving to an active credential;
- `X-Request-Id` as a UUID;
- the `document:ingest` permission.

`POST` additionally requires:

- `Content-Type: application/json`;
- `Idempotency-Key` with 16–128 allowlisted characters;
- body `request_id` equal to `X-Request-Id`;
- body `tenant_id` equal to the credential tenant.

Authentication and the tenant/principal/operation rate gate complete before the
body is parsed. The shared HTTP reader caps JSON bodies at 16 KiB.

## Enqueue request

```json
{
  "schema_version": "v1",
  "request_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "tenant_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "pipeline_profile": "municipal_document_v1",
  "document_version_id": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "artifact_sha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
}
```

The digest must exactly match the registered version. The server resolves the
profile to its configured extractor, chunk policy, embedding provider/model,
1,536-dimension vector contract, and maximum attempt policy. A client cannot
override any component. If no compatible provider is configured, the route
returns `503 capability_unavailable` without enqueueing work.

## Results

| Operation | Status | Meaning |
|---|---:|---|
| first matching enqueue | 202 | `result = new` |
| same principal/key/request | 200 | `result = replay`, same job |
| different key, same active work | 202 | `result = duplicate_work`, same job |
| same key, different request | 409 | `idempotency_conflict` |
| missing/version-hash mismatch | 409 | `document_version_conflict` without existence detail |
| own visible job read | 200 | `result = status` |
| missing/cross-tenant/profile-hidden read | 404 | uniform `not_found` |
| operation rate exceeded | 429 | `rate_limit_exceeded` plus `Retry-After` |

The response job includes its UUID, document-version UUID, public profile,
status, attempts, bounded timestamps, and stable error code/retryability. It
does not include the artifact digest, raw idempotency key, provider/model,
worker identity, or lease token.

## Audit and persistence

Migration `006_ingestion_api_runtime.sql` adds a forced-RLS rate table for
`ingestion_job_enqueue_v1` and `ingestion_job_get_v1`. Known authenticated
decisions are inserted into tenant-owned `audit.events` with correlation,
credential UUID, fixed route/operation, stable reason, and optional job UUID.
No request body, raw key, credential, artifact bytes, source text, worker, lease,
or arbitrary exception is written.

Pre-authentication failures use the tenantless
`audit.ingestion_authentication_failures` aggregate. The application role can
invoke only `audit.record_ingestion_authentication_failure`; it cannot read the
table.

Representative least-privilege additions for the already managed runtime role
are:

```sql
GRANT USAGE ON SCHEMA identity, integration, audit, rag TO la_muni_rag_app;
GRANT EXECUTE ON FUNCTION
  identity.authenticate_api_credential(BYTEA) TO la_muni_rag_app;
GRANT EXECUTE ON FUNCTION
  audit.record_ingestion_authentication_failure(UUID, UUID, TEXT)
  TO la_muni_rag_app;
GRANT SELECT ON rag.documents TO la_muni_rag_app;
GRANT SELECT, UPDATE ON rag.document_versions TO la_muni_rag_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  rag.ingestion_jobs,
  rag.embedding_vectors,
  integration.ingestion_api_rate_limits
  TO la_muni_rag_app;
GRANT INSERT ON audit.events TO la_muni_rag_app;
```

The role must remain a table non-owner, non-superuser, and non-`BYPASSRLS`.
Actual grants are deployment-owned and require review; this example does not
provision a production identity.

## CORS and production routing

`V1_CORS_ALLOWED_ORIGINS` is an exact comma-separated allowlist. The route
advertises `GET, POST, OPTIONS` only to an exact origin and always emits
`Vary: Origin`. Absence of `Origin` is valid for server-to-server use.

The route is evaluated before the production legacy `/api/*` denial. Setting
`NODE_ENV=production` therefore keeps this authenticated v1 family available
while returning non-CORS 404 for pre-v1 routes.

## Worker handoff

An enqueued job does not find or open bytes. A separately reviewed worker must
inject an `AcceptedArtifactResolver` that supplies the exact leased tenant,
version, digest, immutable object generation, private bytes, and current clean
scan evidence. `TenantIngestionWorker` verifies this evidence and the bytes,
heartbeats, parses/embeds outside the final transaction, and calls the durable
fenced completion service.

No resolver, object-store adapter, scanner, worker loop, or deployment is
configured in this feature. `/health` therefore reports
`workerConfigured: false`. See [Tenant Vector and Ingestion Runtime](../tenant-ingestion-runtime.md)
and the [ingestion runbook](../data/ingestion-runbook.md).

## Disposable verification

After building and applying migrations `001..006` plus the guarded SQL fixture:

```bash
DATABASE_URL="$DISPOSABLE_RUNTIME_URL" npm run smoke:tenant-ingestion
DATABASE_URL="$DISPOSABLE_RUNTIME_URL" npm run smoke:ingestion-api
```

The compiled API smoke uses synthetic records only and covers 401/403/404/409,
new/replay/dedup, 429, exact CORS, RLS-scoped persistence, and response secrecy.
It reports `controlledArtifactsRead: 0`. This is local evidence, not staging,
load, scanner/storage, deployed-worker, or production authorization.
