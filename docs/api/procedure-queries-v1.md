# Procedure query API v1

`POST /api/v1/procedure-queries` is the tenant-isolated server-to-server entry
point for OS Electoral to request documentary evidence or procedure analysis. The
runtime implements `requested_output: "evidence_bundle"` and
`requested_output: "procedure_workflow"`. The valid contract value
`procedure_assessment` receives a structured, non-retryable
`503 capability_unavailable`; the service does not imply that the unimplemented
assessment lifecycle exists.

The canonical request, response, and error definitions are the draft 2020-12
schemas in `contracts/schemas/v1/`. Runtime validation loads that registry with
Ajv before accepting a request and validates the generated artifact against the
schema selected by `requested_output` before it can be audited, cached, or returned.

## Required headers

- `Authorization: Bearer …` authenticates through a SHA-256 digest lookup.
- `Content-Type: application/json` is mandatory.
- `X-Request-Id` must be a UUID and equal `request_id` in the body.
- `Idempotency-Key` is required, 16–128 characters, and limited to
  `A-Z a-z 0-9 . _ : -` after an alphanumeric first character.

Authentication and `integration:query` authorization happen before body
parsing. Every `401` is the same contract response and includes
`WWW-Authenticate: Bearer realm="la-muni-rag"`. Missing permission, tenant
mismatch, and credential-provenance mismatch share the same non-enumerating
`403 Access denied` shape.

## Product boundary

This endpoint returns documentary evidence and procedure workflows only. It
rejects electoral strategy, voter segmentation, persuasion, or targeting and
directs those tasks to OS Electoral. It rejects content generation and content
calendars and directs those tasks to Content Agency. Boundary requests are not
compiled.

## Evidence and workflow safety

Every retrieval query runs on the transaction client where
`app.tenant_id` was set with transaction-local scope. The keyword and phrase SQL
also filters `document_sections`, `document_versions`, `documents`, and
`municipalities` explicitly by tenant. It admits only active documents whose
version extraction status is `processed`; the response mapper repeats this
check before a source can become citable. Deep-dive hybrid retrieval combines only
those scoped keyword and phrase searches; the v1 path receives no global pool
search or vector repository.
Although the legacy retriever fans out logical searches, the v1 compiler
serializes database calls on that single transaction-bound `pg` client. This
avoids unsupported concurrent query execution on one PostgreSQL connection.

A `ProcedureWorkflow` response is always `workflow_version: "1.0.0"`,
`approval_status: "draft"`, and `generated_by: "ai"`. Actor, unit, deadline,
external system, and follow-up cadence remain `null` unless a later contract
explicitly supports evidence-bound values. Current v1 never fills them from a
template. An `EvidenceBundle` is generated from the same compiled workflow and
identity-bound evidence: only cited steps become claims; unsupported material is
returned as `missing_evidence`; contradictions remain empty unless an explicit
conflict record exists. The bundle states that it contains no campaign strategy,
segmentation, territory, mobilization, or campaign decision.

A retrieved excerpt becomes
a citation only when document, version, section, and an HTTP(S) source URL are
all present. The document must also carry the exact
`metadata.confidentiality = "public"` classification; missing or non-public
classification fails closed in both SQL and the response mapper. Otherwise its
step is downgraded to `missing_evidence` and a gap is returned. An Antigua source is official for the target only when the request
names the canonical Antigua Guatemala jurisdiction; for every other caller
jurisdiction it is comparative. Mixco material is labeled comparative and carries the contract's
mandatory warning; it never defines Antigua Guatemala's procedure by itself.

## Idempotency, limits, audit, and storage

Migration `004_procedure_query_api.sql` adds tenant-RLS tables for idempotency
and fixed-window rate limiting. The atomic tenant/principal rate gate runs
immediately after authentication, before permission denial, header/body
validation, idempotency replay, or compilation, so invalid authenticated traffic
cannot bypass admission control. The first exceeded request in a window creates
one aggregate audit event; later exceeded requests reference that audit identity
without growing `audit.events` for every rejected call. The idempotency key and canonicalized request are
stored only as SHA-256 digests. A completed response is stored as exact serialized
text so an identical replay can return the same bytes. The raw inbound body and
Bearer credential are never stored.

Completed replay records expire after 24 hours. Cleanup is opportunistic for
the authenticated tenant/principal/operation; the rate table retains at most
the current and immediately preceding logical windows for an active caller.
This is not a global retention scheduler. A replay is never emitted merely
because bytes exist in PostgreSQL: it must still be status 200, validate as the
current requested `EvidenceBundle` or `ProcedureWorkflow`, and match tenant,
request, credential, and original audit identities. A corrupt completed record is
deleted, audited once as
`idempotency_corrupt`, and returned as a non-leaking 500; the next identical
request can safely recompute.

Known authenticated allow/deny outcomes are written to tenant-owned
`audit.events` with allowlisted classifications and correlation identifiers.
Audit details contain no question, facts, body, Bearer credential, or raw
idempotency key. Pre-authentication failures cannot truthfully name a tenant, so
the migration provides the tenantless, fully revoked
`audit.authentication_failures` table and the narrow
`audit.record_authentication_failure` SECURITY DEFINER function. It accepts only
UUID correlation and one of two reason codes; route, event type, and outcome are
fixed. If PostgreSQL itself is unavailable, this best-effort authentication audit
cannot be persisted; the client still receives the uniform `401` so database
availability does not become a credential oracle. Infrastructure monitoring must
alert on database unavailability without logging request headers or bodies.
Authentication failures are aggregated globally by minute and allowlisted
reason and retained opportunistically for 30 days, preventing an unauthenticated
audit-amplification row per attempt. The aggregate is intentionally tenantless.

The deployment application role is expected to be a non-owner without
`BYPASSRLS`. In addition to the grants documented for migration 003, deployment
must grant only the needed privileges:

```sql
GRANT USAGE ON SCHEMA identity, integration, audit, rag TO la_muni_rag_app;
GRANT EXECUTE ON FUNCTION
  identity.authenticate_api_credential(BYTEA) TO la_muni_rag_app;
GRANT SELECT ON rag.municipalities, rag.documents,
  rag.document_versions, rag.document_sections TO la_muni_rag_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  integration.procedure_query_idempotency,
  integration.procedure_query_rate_limits TO la_muni_rag_app;
GRANT INSERT ON audit.events TO la_muni_rag_app;
GRANT EXECUTE ON FUNCTION
  audit.record_authentication_failure(UUID, UUID, TEXT) TO la_muni_rag_app;
```

The authentication-failure table itself remains inaccessible to the runtime
role. Operators may grant read access to a separate audit-reader role.

## CORS

This v1 route uses an
exact configurable allowlist from `V1_CORS_ALLOWED_ORIGINS` (comma-separated) or
the injected server option. It always emits `Vary: Origin` and emits
`Access-Control-Allow-Origin` only for an exact match. Server-to-server clients
without an `Origin` header are unaffected. The pre-v1 routes retain wildcard
CORS only when legacy mode is explicitly available; `NODE_ENV=production`
disables every other `/api/*` route before legacy CORS and returns a non-CORS
404. `/health` and static assets remain intentionally public.

## Disposable database verification

`db/tests/procedure_query_runtime_gate.sql` is guarded to run only in a database
named exactly `la_muni_rag_test`. After migrations `001`, `002`, legacy vector
`011`, `003`, both seeds, and `004`, it creates a disposable non-owner runtime
role and proves missing/malformed tenant fail-closed behavior, tenant A/B read
and write isolation, scoped uniqueness, credential lookup, aggregate auth audit,
and the success-only idempotency constraint.

After `npm run build`, `npm run smoke:postgres-api` starts the compiled handler
against that fixture. On 2026-07-18 the isolated gate used PostgreSQL 16.14 and
pgvector 0.8.5 and observed statuses
`200, 200, 409, 403, 400, 401, 500, 200`: success, byte-exact replay, conflict,
tenant denial, boundary refusal, unauthenticated denial, corrupt-replay denial,
and successful recomputation. The production-default probe also returned a
non-CORS 404 for `/api/search`. These are local disposable-environment results,
not staging, load, consumer-interoperability, or production evidence.
