# Feature 067 — Tenant Catalog API v1

## Objective

Expose the minimum governed catalog surface for sources, documents, ingestion-job monitoring and procedures without weakening the existing source-authority, artifact-safety, tenancy or workflow-governance boundaries.

## Routes

```text
GET  /api/v1/sources
POST /api/v1/sources
GET  /api/v1/documents
POST /api/v1/documents
GET  /api/v1/ingestion-jobs
GET  /api/v1/procedures
```

Search and the dedicated EvidenceBundle route are separate slices because they require retrieval-provider availability and quality semantics beyond catalog persistence.

## Security requirements

- Bearer authentication precedes request-body parsing.
- The authenticated credential tenant is authoritative.
- POST bodies and GET query parameters include `tenant_id`; mismatches return the same non-leaking `403` as missing permission.
- Read operations require `source:read`, `document:read`, `document:ingest`, or `procedure:read` respectively.
- Write operations require `source:write` or `document:write`.
- All persistent catalog tables use transaction-local tenant context and `FORCE ROW LEVEL SECURITY`.
- Collection reads use bounded keyset pagination and never expose cross-tenant counts or identifiers.
- POST operations require an allowlisted `Idempotency-Key`, canonical request digest, exact replay and conflict fencing.
- Authenticated rate limits and allowlisted audit events apply before mutation or collection reads.
- Framed request bodies on GET are rejected without repository access.

## Source semantics

A caller may register discovery information, not authority conclusions. New records are always:

```yaml
validation_state: unreviewed
official_source: false
official_for_target_jurisdiction: false
acquisition_state: not_acquired
ingestion_state: not_ingested
retrieval_state: not_indexed
```

The request cannot set official status, effective validity, acquisition, scan, ingestion or retrieval completion. `source_relation` expresses only the registrant's intended classification (`target`, `national`, `comparative`, `unknown`) and remains unreviewed.

Supported discovery states:

```text
identified
access_blocked
unverified
missing_source
```

A `missing_source` record cannot carry a discovery or artifact URL. Comparative sources always include the canonical warning and cannot become official for Antigua through this API.

## Document semantics

A document registration creates one document and one immutable declared version. It requires:

- an existing tenant-owned source;
- title, type, scope and confidentiality;
- version label;
- exact SHA-256, media type and optional public source URL.

The server owns initial status:

```yaml
document_status: draft
extraction_state: queued
artifact_acceptance: not_accepted
ingestion_state: not_started
retrieval_state: not_indexed
```

A digest alone is not acquisition or acceptance. Object and clean-scan identities are returned only when the existing artifact-acceptance subsystem has accepted that exact document version. Private object coordinates, signed URLs, scanner internals, lease/fencing material and raw provider errors are never returned.

## Ingestion-job monitoring

The collection returns safe states only:

```text
queued
processing
retry_wait
processed
failed
cancelled
superseded
```

The current durable runtime maps queued work whose `available_at` is in the future and has a retryable error to `retry_wait`. Internal lease/fencing digests, pipeline configuration, object coordinates and raw error messages are omitted.

## Procedure catalog

The procedure collection is read-only. It returns procedure identity plus latest and approved version summaries. Workflow definitions, review notes and approval notes remain behind the existing item/lifecycle APIs. A procedure without an approved version is visibly unapproved.

## Pagination

- `limit`: integer 1–100, default 25.
- `cursor`: opaque base64url keyset cursor produced by the server.
- Sorting: `created_at DESC, id DESC`.
- Responses include `next_cursor` only when another page exists.
- Source requests accept at most 15 limitations so the server-owned comparative warning remains within the persisted 16-item bound.
- Invalid or oversized cursors return `400` without query execution.

## Non-goals

- authority validation or legal applicability decisions;
- artifact upload, object-store mutation or malware scanning;
- source acquisition or document ingestion;
- workflow approval or case mutation;
- OS Electoral or Content Agency capabilities;
- production deployment.

## Acceptance

- strict JSON Schemas/examples/OpenAPI;
- adversarial HTTP tests for auth-before-body, RBAC, tenant mismatch, replay/conflict, pagination, GET-body rejection and metadata minimization;
- migration tests for forced RLS, immutable source authority defaults and safe audit/rate/idempotency state;
- PostgreSQL non-owner gate with tenant A/B fixtures;
- compiled HTTP smoke against PostgreSQL;
- `EVAL-SOURCE-API-001` and `EVAL-DOCUMENT-API-001`;
- full regression remains green.
