# Feature 068 — Dedicated Search and EvidenceBundle API v1

## Objective

Implement production-shaped, tenant-scoped endpoints:

```http
POST /api/v1/search
POST /api/v1/evidence-bundles
```

The endpoints expose documentary retrieval and a conservative evidence artifact only. They do not decide legal applicability, approve procedures, generate electoral strategy, or create content.

## Security and execution order

For both endpoints:

1. authenticate the bearer credential before parsing the body;
2. require `evidence:query` before parsing the body;
3. validate `X-Request-Id`, rate limits, content type, JSON and the closed schema;
4. bind body `tenant_id`, `request_id` and provenance `credential_id` to the authenticated principal;
5. execute all PostgreSQL work inside the transaction-local tenant context;
6. emit bounded, non-secret audit records and contract-valid errors.

`POST /api/v1/evidence-bundles` additionally requires a valid `Idempotency-Key`, exact-byte replay, canonical semantic reconstruction and committed invalidation of corrupt completed replay state.

## Request contract

Both requests contain:

- `schema_version: "v1"`;
- route-specific `operation`;
- `request_id` and `tenant_id` UUIDs;
- `query` of 1–4000 characters;
- `jurisdiction` of 2–240 characters;
- explicit `as_of_date` (`YYYY-MM-DD`) for reproducible temporal classification;
- `mode`: `keyword`, `phrase`, `semantic` or `hybrid`;
- `limit`: integer 1–50;
- closed bounded filters:
  - `document_types`: unique enum values, at most 16;
  - `source_relations`: unique `target|national|comparative|unknown`, at most 4;
  - `authority_statuses`: unique `official_target_jurisdiction|official_national|comparative|unknown`, at most 4;
  - `temporal_statuses`: unique `current_by_stored_dates|future_by_stored_dates|expired_by_stored_dates|undetermined`, at most 4;
  - `source_ids`: unique UUIDs, at most 20;
- provenance containing only `credential_id`.

An empty filter array means no restriction for that dimension.

## Retrieval eligibility

A result is eligible only when all persisted controls are true:

- source, document, version, section/chunk and tenant identities agree;
- source acquisition is `acquired`, ingestion is `ingested`, and retrieval is `indexed`;
- document is `active` and `public`;
- extraction is `processed`;
- an exact artifact object is currently accepted against an append-only clean scan and matching digest;
- a bound ingestion job is `processed`;
- a non-empty citation label, excerpt and public URL are available;
- public URLs contain neither embedded credentials nor temporary signature parameters.

Private object coordinates, scanner versions, lease/fencing tokens, raw errors and pipeline configuration never enter the API projection.

## Retrieval modes

- `keyword`: PostgreSQL Spanish full-text search.
- `phrase`: exact case-insensitive phrase search.
- `semantic`: query embedding plus tenant/model/dimension-bound pgvector search.
- `hybrid`: keyword, phrase and semantic candidates combined with deterministic reciprocal-rank fusion after citation-identity deduplication.

`semantic` and `hybrid` are fail-closed. Missing, incomplete, dimension-incompatible or failing embedding capability returns `503 capability_unavailable`; the endpoint must not silently return keyword-only results while claiming semantic or hybrid execution.

## Authority and temporal state

Authority is derived from persisted source state:

- `official_target_jurisdiction`: source is validated, official, official for the target jurisdiction and its stored target jurisdiction matches the request;
- `official_national`: source is validated, official and national;
- `comparative`: source is marked comparative or belongs to another jurisdiction;
- `unknown`: all other cases.

Temporal state is derived only from stored effective/repeal dates relative to `as_of_date`:

- `current_by_stored_dates` requires an effective date on/before the requested date and no repeal on/before it;
- `future_by_stored_dates` means the stored effective date is later;
- `expired_by_stored_dates` means the stored repeal date is on/before it;
- `undetermined` means stored dates do not establish a current interval.

These labels are documentary classifications, not legal conclusions.

## Search response

The closed response reports:

- requested mode and the exact executed modes;
- result count and bounded results;
- citation/document/source identity;
- authority, temporal and evidence-use state;
- public source URL and SHA-256 provenance;
- retrieval score, score semantics and matched modes;
- explicit limitations that returned rows do not prove corpus completeness, legal applicability or quality.

A result is `supported` only when authority is validated official target/national and temporal state is `current_by_stored_dates`. A current/undetermined comparative result is `comparative_reference`. Everything else is `validation_required`.

## EvidenceBundle response

The dedicated route emits the existing `EvidenceBundle v1` contract.

- sources and citations preserve exact identity and public provenance;
- only `supported` candidates may become claims;
- claim text is a bounded documentary excerpt, not a generated legal conclusion;
- comparative and validation-required candidates may remain visible as sources/citations but are never promoted to claims;
- conflicting document versions at the same citation location remove affected claims, create explicit contradictions and require human review;
- no supported claim produces explicit `missing_evidence` and a next documentary action;
- Mixco/comparative material retains the mandatory Antigua corroboration warning;
- provenance is system-generated and bound to credential/audit identity.

## Persistence

Migration `015_search_evidence_api.sql` creates:

- digest-only EvidenceBundle idempotency state;
- bounded rate-limit state for search and bundle operations;
- minimized authentication-failure aggregation;
- forced RLS and public revocation for all new tables/functions.

The runtime gate grants only the columns required to retrieve public evidence and write API control state/audits. It must prove a non-owner, `NOSUPERUSER`, `NOBYPASSRLS` role cannot read private artifact coordinates or cross-tenant rows.

## Verification

Required gates:

- RED/GREEN unit and adversarial HTTP tests;
- migration/static tests;
- named `EVAL-SEARCH-API-001` and `EVAL-EVIDENCE-BUNDLE-API-001`;
- closed schemas, examples and OpenAPI 3.1.1 validation;
- fresh migrations 001–015;
- non-owner PostgreSQL SQL/RLS gate;
- compiled HTTP smoke covering keyword, semantic/hybrid capability failure, supported/non-promoted evidence, exact replay and cross-tenant denial;
- typecheck, build, complete regression, dependency audits and `git diff --check`;
- independent detached-checkout verification before publication.
