# Catalog API v1

Feature 067 exposes the first governed tenant catalog surface for LA Muni RAG.
It is an authenticated operational API, not a public source directory and not an
authority-validation service.

## Routes

```text
GET  /api/v1/sources
POST /api/v1/sources
GET  /api/v1/documents
POST /api/v1/documents
GET  /api/v1/ingestion-jobs
GET  /api/v1/procedures
```

`POST /api/v1/ingestion-jobs` and `GET /api/v1/ingestion-jobs/{job_id}` remain
owned by the existing ingestion API. Search and a dedicated EvidenceBundle route
are separate retrieval slices.

## Authentication and tenant binding

Every request requires a Bearer credential. Authentication and permission checks
occur before POST body parsing. The credential tenant is authoritative; the
request or query `tenant_id` must match it exactly.

| Route | Permission |
|---|---|
| source list | `source:read` |
| source registration | `source:write` |
| document list | `document:read` |
| document registration | `document:write` |
| ingestion-job list | `document:ingest` |
| procedure list | `procedure:read` |

The persistence layer sets transaction-local tenant context and all catalog-owned
tables use `FORCE ROW LEVEL SECURITY`. Cross-tenant denials use uniform `403` or
empty tenant-scoped results and never disclose foreign identifiers or counts.

## Source registration

A caller registers discovery metadata. The API always creates:

```yaml
validation_state: unreviewed
official_source: false
official_for_target_jurisdiction: false
acquisition_state: not_acquired
ingestion_state: not_ingested
retrieval_state: not_indexed
```

The request schema has no authority, validity, acquisition, scan, ingestion or
retrieval-completion fields. A comparative source receives the mandatory warning:

> Referencia comparativa de otra municipalidad. No define por sí sola el procedimiento oficial de La Antigua Guatemala. Requiere corroboración con fuente nacional o de La Antigua Guatemala.

`missing_source` records cannot contain discovery or artifact URLs. URLs with
userinfo or temporary credential parameters such as `token`, `sig`, `x-amz-*`
or `x-goog-*` are rejected by the HTTP boundary and database constraints.

## Document registration

Document registration requires an existing tenant source and creates one declared
version with an exact SHA-256. Initial server-owned state is:

```yaml
document_status: draft
extraction_state: queued
artifact_acceptance: not_accepted
ingestion_state: not_started
retrieval_state: not_indexed
```

A digest does not prove possession, clean scan, extraction, ingestion, retrieval
quality, validity or legal applicability. Private object coordinates, signed
URLs, scanner internals, lease/fencing tokens, pipeline configuration and raw
provider errors are excluded from responses and from runtime column grants.

## Collection pagination

All collections use keyset pagination ordered by `created_at DESC, id DESC`.

```text
limit  1..100, default 25
cursor opaque base64url server cursor
```

Invalid, repeated or oversized parameters return `400` before repository reads.
The response contains `next_cursor` only when another page exists.

## Idempotency and replay

POST routes require `Idempotency-Key`. Persistence stores only SHA-256 digests of
the key and canonical request. Completed replay requires:

- response SHA-256;
- current response schema;
- request, tenant, credential and audit identity;
- persisted aggregate identity;
- exact canonical reconstruction from the original request and server-owned
  initial state.

A schema-valid but semantically altered replay is deleted in a committed
transaction before a generic `500 replay_invalid` is emitted.

## Safe ingestion-job monitoring

The list exposes:

```text
queued
processing
retry_wait
processed
failed
cancelled
superseded
```

`retry_wait` is derived from queued work with a retryable error and future
`available_at`. The response omits lease/fencing material, object coordinates,
pipeline configuration, credentials and raw error stacks.

## Procedure catalog

The list returns procedure identity, jurisdiction and latest/approved version
summaries. Workflow definitions, review notes and approval notes remain behind
the existing workflow lifecycle item routes.

## Limits

This API does not:

- validate a source as official or current;
- acquire or scan an artifact;
- ingest or index a document;
- evaluate retrieval quality;
- approve a workflow;
- mutate cases;
- provide a human SaaS session;
- deploy production infrastructure.
