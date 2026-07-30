# Feature 067 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| GET/POST sources | `catalogHandler.ts`, `catalog/repository.ts`, `rag.sources` | HTTP adversarial suite, EVAL-SOURCE-API-001, SQL gate, compiled smoke |
| GET/POST documents | existing document/version tables plus migration 014 binding | HTTP suite, EVAL-DOCUMENT-API-001, SQL gate, compiled smoke |
| GET ingestion jobs | safe projection over durable jobs | unit/API tests and compiled PostgreSQL smoke |
| GET procedures | summary projection over governed workflow lifecycle | unit/API tests and compiled PostgreSQL smoke |
| authentication before body | catalog handler decision order | malformed unauthenticated/forbidden body tests |
| RBAC | existing permission matrix | manager/viewer tests and non-owner smoke |
| authenticated tenant binding | request/query tenant match plus transaction-local context | cross-tenant `403`, A/B SQL gate and smoke |
| strict JSON Schema | eight closed schemas and examples | contract registry 27/27 and negative promotion tests |
| pagination and filters | bounded keyset cursor and allowlisted query parameters | two-page API test, cursor/filter validation |
| idempotency/replay | digest-only table, exact bytes, canonical reconstruction | exact replay, conflict and semantic corruption tests; PostgreSQL cleanup receipt |
| rate limiting | forced-RLS operation buckets | bounded read/write rate test |
| audit minimization | allowlisted IDs, operation and reason code | code inspection, schema and secret scans |
| no metadata leakage | explicit SQL projections, column grants, closed responses | private-coordinate and job-secret negative assertions |
| OpenAPI | OpenAPI 3.1.1 paths for six operations | strict validator and integration-contract suite |
| PostgreSQL non-owner gate | `db/tests/catalog_api_runtime_gate.sql` | PostgreSQL 15.18/pgvector 0.8.5 fresh 001–014 run |
| compiled HTTP runtime | `scripts/catalog-api-postgres-smoke.mjs` | statuses `401/201/201/409/500/400/201/201/200/200/200/200/403/200` |
| product boundaries | catalog-only scope, no electoral/content capabilities | boundary scan and ADR/non-goals |

## Explicit non-proofs

Feature 067 does not prove source validity, durable acquisition, clean malware
scan, extraction, ingestion, retrieval quality, legal applicability, human SaaS
authentication, production topology, merge or deployment.
