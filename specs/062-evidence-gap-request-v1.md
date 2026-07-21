# 062 — EvidenceGapRequest Provider v1

Status: implemented and verified locally; publication and remote CI pending

Related artifacts:

- `specs/062-evidence-gap-request-v1-plan.md`;
- `specs/062-evidence-gap-request-v1-tasks.md`.

## Objective

Implement `POST /api/v1/evidence-gap-requests` as the authenticated,
tenant-scoped intake for documentary research gaps requested by OS Electoral.
LA Muni RAG creates one server-owned immutable `open` gap record while preserving
request identity and product boundaries.

## Ownership and boundary

OS Electoral owns the opaque campaign reference and the fact that it requested
research. LA Muni RAG owns gap intake, documentary validation, source authority,
status, audit and any eventual resolution. Submitting a request never declares a
source official, current, applicable, acquired, scanned, ingested or resolved.

This endpoint performs intake only. It does not run retrieval, compile a
procedure, generate campaign strategy, create content, or resolve the gap.

## Contract

Canonical contracts:

- `contracts/schemas/v1/evidence-gap-request.schema.json`;
- `contracts/schemas/v1/evidence-gap-response.schema.json`;
- `contracts/openapi/v1/openapi.json`.

The request is closed and accepts only:

```text
gap_request_id
request_id
tenant_id
subject
missing_document
reason
priority
campaign_reference
jurisdiction
provenance
```

The response repeats the bounded documentary intake, fixes `status=open` and
`request_assertion_status=requester_supplied_unverified`, and uses server-owned
`la_muni_rag/system` provenance. It contains no source URL,
official-source flag, authority determination, legal applicability, campaign
strategy, content task or publication instruction.

## Idempotency and identity

- `Idempotency-Key` scopes transport replay to tenant + authenticated principal.
- `gap_request_id` is the stable aggregate identity within a tenant.
- Same key + same canonical request returns exact bytes.
- Same key + different request returns `idempotency_conflict`.
- Same gap ID + same canonical request under another key returns the original
  validated bytes.
- Same gap ID or `request_id` + different canonical request returns
  `gap_request_conflict`.
- Raw keys and Bearer credentials are never persisted.
- Stored bytes are SHA-256 bound and are reconstructed canonically before replay.

## Data model

Migration `012_evidence_gap_requests.sql` adds:

```text
rag.evidence_gap_requests
integration.evidence_gap_idempotency
integration.evidence_gap_rate_limits
audit.evidence_gap_authentication_failures
audit.record_evidence_gap_authentication_failure(...)
```

`rag.evidence_gap_requests` is tenant-leading, uses composite tenant foreign
keys, stores one exact acknowledgement and is protected by FORCE RLS plus a
trigger that rejects `UPDATE` and `DELETE`. The runtime role receives only
`SELECT` and `INSERT` on this aggregate.

Transport replay and rate admission use dedicated tables so keys cannot collide
with ProcedureQuery, ClaimPack, ingestion or workflow lifecycle operations.

## Security and privacy considerations

1. Authentication completes before body parsing.
2. The authenticated rate gate runs before permission and schema validation.
3. `integration:query` is required.
4. Tenant and credential provenance are bound to the authenticated principal.
5. Foreign tenant denial is the uniform non-enumerating `403` response.
6. Unknown fields and authority declarations fail closed.
7. Electoral strategy and content-production requests are rejected at the
   product boundary.
8. Audit stores allowlisted identifiers, outcome, reason and key digest only;
   it stores no subject, missing-document text, reason, campaign reference,
   headers, raw key or credential.
9. The domain aggregate stores the bounded research request because that is the
   product record. Retention/deletion remains a human privacy decision before
   production.
10. Pre-tenant auth failures are minute/reason aggregates and cannot be read by
    the application role.

## Acceptance criteria

1. Authentication and coarse RBAC complete before body parsing.
2. Tenant and credential provenance come from the authenticated credential and
   must match the request.
3. JSON Schema validation is strict and unknown/authority-declaration fields fail.
4. Rate limiting happens before mutation.
5. Aggregate insertion, idempotency completion and tenant audit are atomic.
6. Forced RLS and tenant-leading composite keys protect all tenant data.
7. Missing and cross-tenant identities are not enumerable.
8. Exact replay is schema/digest/tenant/audit/canonical-semantics validated.
9. Corrupt stored replay is invalidated and never leaked.
10. OpenAPI, contract tests, non-owner SQL gate and compiled HTTP smoke pass.
11. The endpoint does not implement research resolution, source validation,
    campaign strategy or content production.

## Test and eval plan

Named gate:

```text
npm run eval:evidence-gap
```

Coverage:

- strict schemas and anti-authority fields;
- auth-before-body and uniform 401;
- RBAC, tenant and credential denial;
- exact key replay and aggregate-ID replay;
- idempotency and aggregate conflicts;
- rate limiting and bounded denial audit;
- corrupt and contract-valid-but-noncanonical replay invalidation;
- audit content minimization;
- real PostgreSQL FORCE RLS, composite FKs, response hashes, inmutability,
  pre-tenant aggregate and non-owner privileges;
- compiled HTTP smoke through the application role.

Local verified evidence at implementation checkpoint:

```text
EVAL-EVIDENCE-GAP-001: 11/11
migration/contract boundary tests: 3/3
contract registry: 17 schemas / 17 examples / OpenAPI 3.1.1
PostgreSQL 15.18 / pgvector 0.8.5 non-owner gate: pass
compiled HTTP smoke: pass
```

## Rollback

Rollback is operational and forward-only:

1. disable routing to `POST /api/v1/evidence-gap-requests`;
2. preserve already accepted immutable gap records and audit evidence;
3. stop granting new route permissions;
4. deploy a forward migration for any schema correction.

No automatic table drop, destructive migration or data deletion is part of this
feature branch.
