# Requirements Traceability — Feature 057

| Requirement | Implementation | Verification |
|---|---|---|
| Canonical enqueue/status contracts | ingestion request/response schemas, examples, OpenAPI paths | strict registry and OpenAPI tests; 11 schemas/examples pass |
| Authenticate before body parsing | `handleIngestionJobV1` authenticates before `readJsonBody` | malformed unauthenticated body returns uniform 401 |
| Apply bounded admission before work | operation-specific `authenticatedRateGate` | unit rate test and real 429/DB counter smoke |
| Enforce role and tenant | `document:ingest`, `requireTenantMatch` | viewer and body-tenant 403 tests plus real HTTP smoke |
| Keep pipeline server-owned | closed profile and dependency-owned config | schema extension rejection and enqueue-input assertions |
| Bind existing version to artifact identity | durable service version/hash lookup | real new/replay/conflict HTTP smoke |
| Preserve durable idempotency/work semantics | `PostgresIngestionJobService.enqueue` | 202 new/dedup, 200 replay, 409 conflict with stable job ID |
| Hide cross-tenant resource existence | tenant-scoped `get`, configured-profile check, uniform 404 | own 200 plus cross-tenant/missing 404 parity |
| Exclude control/pipeline secrets from response | closed response mapper | schema/test and compiled HTTP text inspection |
| Contract-shape every response/error | Ajv validators and shared ApiError serializer | handler and integration-contract suites |
| Use exact v1 CORS | `handleV1Cors(..., ["GET", "POST"])` | trusted/untrusted preflight and response tests |
| Force tenant isolation on API state | migration `006` rate table RLS/policy | static migration and non-owner catalog/missing-context gate |
| Aggregate pre-tenant failures safely | revoked table and fixed-search-path function | static test, unreadability and two-call aggregate SQL gate |
| Accept only injected immutable bytes | `AcceptedArtifactResolver` interface; no default adapter | worker construction/code review and resolver request test |
| Bind current clean evidence | `verifyAcceptedArtifact` | stale/mismatched evidence test |
| Prevent parser-side byte substitution | private copy and post-extraction SHA-256 | mutation test blocks provider/completion |
| Match leased worker pipeline | extractor/provider/model/dimension checks | mismatch terminal-failure test |
| Maintain lease ownership | heartbeat checkpoints and Feature 056 fencing | heartbeat success and lost-lease tests |
| Keep provider work outside final DB transaction | prepare in worker, `complete` afterward | worker/service boundary test and prior atomic DB smoke |
| Keep failures bounded/sanitized | stable classification and durable `fail` | retry/terminal tests; no provider exception persistence |
| Preserve production legacy gate | v1 routing before disabled pre-v1 routes | production server and compiled HTTP 404 smoke |
| Prove migration compatibility | canonical migrations through `006` | fresh and supported historical PostgreSQL runs |
| Stop unsafe unmapped legacy state | unchanged migration `005` exception/transaction | unsafe negative run preserves row and rolls back column |
| Prevent regression in CI | migration `006`, SQL gate, service and API smoke steps | YAML/static operations test and exact-commit GitHub check |
| Do not touch controlled artifact | synthetic fixtures only | every DB/HTTP smoke reports `controlledArtifactsRead: 0` |
| State residual gates honestly | spec/API/runtime/runbook/security/operations updates | documentation/link/governance checks |
