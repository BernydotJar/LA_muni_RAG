# Feature 057 — Authenticated Ingestion API and Bounded Worker

## Goal

Expose a contract-validated, tenant-scoped API for enqueueing and reading
durable ingestion jobs for already registered document versions, and provide a
callable worker boundary that accepts only immutable, clean-scan-bound bytes.

This feature does not upload or acquire files, accept a URL or local path,
implement object storage or a malware scanner, start a worker process, deploy a
service, or authorize ingestion of the controlled DMP. The DMP remains
`acquired` and was not read by this feature.

## Dependencies

- identity, RBAC, transaction-local tenancy, and credential authentication from
  migration `003`;
- the v1 contract/error/CORS foundation and `audit.events` from migration `004`;
- digest-bound jobs, leases, atomic vector completion, and tenant RLS from
  Feature 056 and migration `005`;
- structural and clean-scan evidence rules from Features 054–055;
- migration `006_ingestion_api_runtime.sql` for API rate state and the
  pre-tenant authentication-failure aggregate.

## HTTP contract

The implemented route family is:

```text
POST /api/v1/ingestion-jobs
GET  /api/v1/ingestion-jobs/{job_id}
```

`POST` requires Bearer authentication, `document:ingest`, an exact body tenant
match, `Content-Type: application/json`, a UUID `X-Request-Id` equal to body
`request_id`, and a 16–128 character allowlisted `Idempotency-Key`.
Authentication and the per-principal/operation rate gate finish before body
bytes are parsed. The body is closed by JSON Schema and contains only:

- contract/request/tenant identity;
- server-recognized `pipeline_profile = municipal_document_v1`;
- an existing `document_version_id`;
- the exact lowercase SHA-256 identity already recorded on that version.

Clients cannot select extractor, chunk policy, embedding provider, model,
dimension, attempt count, worker, lease, storage key, URL, or path. The server
owns the exact pipeline configuration. If the configured embedding provider is
absent or not compatible with the 1,536-dimension operational vector schema,
authenticated requests fail with contract-shaped `503 capability_unavailable`.

An early rejection that deliberately leaves a framed request body unread sets
`Connection: close` and disables keep-alive after returning the bounded JSON
error. It does not drain attacker-controlled bytes or leave a paused body on a
reusable socket. A `GET` carrying a framed body is rejected the same way.

`POST` returns `202` for `new` or `duplicate_work`, `200` for an exact replay,
and `409` for idempotency reuse with different work or document-version/hash
conflict. `GET` requires the same permission and returns only a job in the
authenticated tenant whose stored pipeline matches the active server profile.
Missing, cross-tenant, and hidden-profile jobs share the same non-leaking 404.

Responses expose stable job/version/status/timing/provenance fields. They do not
return the artifact digest, raw idempotency key, pipeline provider/model,
worker identity, or lease token. Every success and known authenticated denial is
contract validated and written as a bounded tenant audit decision.

## Rate, audit, and CORS boundary

Migration `006` adds forced-RLS rate rows scoped by tenant, principal,
operation, and fixed window. Defaults are 20 enqueue attempts and 120 status
reads per 60 seconds; deployments may lower these positive integers. The first
blocked request records one aggregate denial audit identity for the window.

Pre-authentication traffic has no trustworthy tenant. A separate fully revoked
`audit.ingestion_authentication_failures` table stores only UUID correlation,
minute bucket, fixed route/event/outcome, an allowlisted reason, count, and
timestamps. The runtime can invoke only a fixed-search-path `SECURITY DEFINER`
aggregate function and cannot read the table.

The route always varies on `Origin`. It emits browser CORS headers only for an
exact configured origin and advertises `GET, POST, OPTIONS`; server-to-server
requests without `Origin` remain valid. The production legacy-route gate stays
ahead of wildcard pre-v1 CORS.

## Accepted-artifact worker contract

`TenantIngestionWorker` has no default storage implementation. An injected
`AcceptedArtifactResolver` must resolve the leased tuple
`(tenant_id, document_version_id, artifact_sha256)` to:

- the same canonical tenant/version/digest;
- a bounded immutable object generation/version, never a mutable `latest` key;
- a bounded basename and declared media type;
- a private byte buffer;
- current `clean` evidence bound to the exact digest, byte length, detected
  media type, structural signature, inspection time, scanner engine/version,
  and definitions version.

Before parser or provider work, the worker copies the bytes, reruns bounded
structural inspection, rehashes them, validates the clean evidence and its
freshness, and rejects any identity mismatch. It enforces the leased
server-owned extractor/provider/model/dimension profile, starts lease
heartbeats, parses the private in-memory bytes, and rehashes them again after
extraction. It then prepares bounded chunks/embeddings outside the final
database transaction and checkpoints the lease before atomic completion.

Stable terminal errors are persisted without raw exceptions. Provider/runtime
failures use bounded durable retry. A heartbeat or completion fencing failure
returns `lease_lost` and does not finalize or try to mutate with a stale token.
The callable result never exposes a lease token.

## Verification evidence

Static and HTTP tests cover strict request/response/error schemas,
authentication-before-parse, uniform auth/dependency errors, permission and
tenant denial parity, malformed headers/body, server-owned policy,
replay/deduplication/conflict, non-leaking GET, per-operation rate control, exact
CORS, scan evidence, byte mutation, provider failure, and lease loss.

The disposable PostgreSQL 16.14/pgvector 0.8.5 gate applies fresh
`001..006` and supported historical `001,002,011,003,004,005,006` orders. Its
non-owner `NOSUPERUSER`/`NOBYPASSRLS` role proves forced rate/job/vector RLS,
missing/malformed context denial, credential lookup, unreadable pre-tenant
storage, and aggregate authentication audit. The compiled HTTP smoke observes:

```text
401, 403, 403, 202, 200, 202, 409, 429, 200, 404, 404
```

It also proves stable replay/dedup job identity, exact CORS, no cross-tenant
status leakage, no raw credential/idempotency persistence, and no artifact
digest/lease/provider disclosure. The prior unsafe post-003 standalone vector
order still stops at migration `005` without changing the unmapped row. Every
database/HTTP smoke reports `controlledArtifactsRead: 0`.

## Residual production boundary

Still required before operational ingestion:

- approved durable object storage, immutable-version adapter, quarantine IAM,
  persisted scan evidence, and real scanner/definition monitoring;
- a separately packaged/deployed worker with workload identity, tenant routing,
  per-attempt deadline/cancellation, backpressure, graceful shutdown, and
  queue/lease metrics;
- approved parser/container OS isolation and total RSS/native-memory/load tests;
- per-tenant queue/storage/provider quotas, cancellation, repair/dead-letter
  tools, and alerting;
- production role grants and continuous attestation, migration ledger,
  populated-data timing, restore/HA/failover, staging, and human release approval;
- a reviewed administrative source/version/upload workflow. This API accepts
  only an existing registry version and is not that workflow.

`/health` reports whether the API pipeline can be constructed but deliberately
reports `workerConfigured: false`. No process starts the callable worker.

## Acceptance criteria

- [x] Strict v1 enqueue/status schemas and OpenAPI paths are canonical.
- [x] Authentication and rate limiting precede request-body parsing.
- [x] Early body-unread rejections close the connection after the error response.
- [x] `document:ingest` and credential-tenant matching are enforced.
- [x] Clients cannot choose pipeline/provider/model/dimension or storage input.
- [x] Replay, duplicate work, conflict, and status semantics use durable state.
- [x] Missing and cross-tenant jobs share a non-leaking 404.
- [x] Responses exclude artifact digest, raw keys, worker, and lease secrets.
- [x] API rate state forces RLS and pre-tenant failures use a narrow aggregate.
- [x] The worker accepts only injected immutable clean-scan-bound bytes.
- [x] Bytes are structurally verified and hashed before and after extraction.
- [x] Heartbeat/fencing and atomic completion use the Feature 056 service.
- [x] Fresh, supported legacy, unsafe-order, compiled DB, and HTTP gates pass.
- [x] Controlled artifacts remain unread and the DMP remains `acquired`.
- [ ] Storage/scanner adapters, worker process/deployment, operational
  observability/load/HA, and production approval remain later gates.
