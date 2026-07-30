# Requirements Traceability — Feature 068 Search and EvidenceBundle API v1

| Requirement | Implementation | Verification |
|---|---|---|
| `POST /api/v1/search` | `src/api/v1/searchEvidenceHandler.ts`, `src/server.ts` | `search-evidence-api-v1.test.ts`, compiled PostgreSQL smoke |
| `POST /api/v1/evidence-bundles` | `src/api/v1/searchEvidenceHandler.ts`, `src/searchEvidence/evidenceBundle.ts` | `eval-evidence-bundle-api-001.test.ts`, compiled PostgreSQL smoke |
| Closed bounded requests | `search-request.schema.json`, `evidence-bundle-request.schema.json` | contract registry 30/30; adversarial extra-field/limit tests |
| Closed Search response | `search-response.schema.json`, `searchResultFromCandidate` | valid example, runtime response validation, HTTP tests |
| Canonical EvidenceBundle response | existing `evidence-bundle.schema.json`, `buildEvidenceBundle` | runtime validation, named eval, smoke |
| Auth before body | `handleSearchEvidenceV1` | malformed unauthenticated body returns uniform 401 |
| Tenant/RBAC/request/credential binding | handler + `withTenantTransaction` | wrong tenant/credential tests and cross-tenant PostgreSQL smoke |
| Keyword retrieval | `PostgresSearchEvidenceRepository.searchKeyword` | in-memory HTTP test and PostgreSQL smoke |
| Phrase retrieval | `searchPhrase` | hybrid execution tests and PostgreSQL smoke |
| Semantic retrieval | `searchSemantic`, existing query embedding provider | provider/model/dimension-bound PostgreSQL smoke |
| Hybrid retrieval | `executeSearch`, RRF merge | explicit executed modes and no lexical-only fallback tests |
| Fail-closed semantic capability | `SearchCapabilityError`, handler 503 mapping, bounded HTTP provider timeout | missing/failing/timed-out provider tests and compiled smoke |
| Accepted artifact and clean scan eligibility | repository SQL joins | static eval, non-owner SQL gate, smoke fixture |
| Processed ingestion and public active document eligibility | repository SQL joins | static eval, SQL gate, smoke |
| Column-level least privilege | `db/tests/search_evidence_api_runtime_gate.sql` | private-column privilege assertions and runtime smoke |
| Derived authority | `authorityStatusFor` | target/comparative HTTP tests and smoke |
| Derived temporal state | `temporalStatusFor` | current status tests and explicit `as_of_date` contract |
| Comparative non-promotion | `buildEvidenceBundle` | named eval, unit test, hash-valid corrupt replay test, smoke |
| Version conflict preservation | `versionConflicts`, contradiction mapping | mapper/replay invariants; real-corpus conflict eval remains future work |
| Exact EvidenceBundle replay | migration 015, repository and handler | byte-equal replay test and smoke |
| Corrupt replay cleanup | semantic replay validator and committed invalidation | tenant corruption, comparative-claim corruption, smoke row-deletion assertion |
| Bounded rate/audit state | migration 015 and handler | repeated-denial test; non-owner table gate |
| OpenAPI 3.1.1 | `contracts/openapi/v1/openapi.json` | strict contract validator checks paths/methods/headers/statuses/refs |
| CI integration | `.github/workflows/ci.yml` | YAML parse, named eval steps, fresh DB gate and compiled smoke steps |
| Product boundary | response limitations, docs and existing RBAC/product boundary | no OS Electoral/Content Agency implementation; boundary/full regression |

## Explicitly not proven

- Antigua-first source acquisition or scan freshness on real artifacts;
- real-corpus keyword/phrase/semantic/hybrid relevance;
- human review of citations, authority, vigencia, supersession and applicability;
- production embedding provider, secrets, cost, latency or reliability;
- merge, deployment, staging, load, HA, backup/PITR or SLO observation;
- consumer repository contract tests.
