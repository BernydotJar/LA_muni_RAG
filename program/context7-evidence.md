# Context7 evidence register

Last updated: 2026-07-19T05:54:37Z

Context7 is the required documentation source for implementation decisions involving APIs, frameworks, SDKs, authentication, PostgreSQL, pgvector, cloud services, Terraform, testing, observability, and security configuration. It is not an authority for legal or municipal claims.

## Availability audit

| field | value |
|---|---|
| library | Context7 CLI |
| library_id | github.com/upstash/context7 |
| installed_version | 0.5.5 via npx |
| query | Resolve CLI availability and retrieve versioned documentation for Node.js, PostgreSQL, OpenAPI 3.1.1, JSON Schema object validation, and Ajv 8 |
| retrieved_at | 2026-07-19T02:34:57Z |
| documentation_summary | Context7 is available through npx ctx7. Five libraries were resolved and their documentation was retrieved. |
| implementation_decision | BLK-CTX7-001 is resolved. Context7 is the active documentation workflow; every technology task must still retrieve and record its own version-specific evidence. |
| source_links | https://github.com/upstash/context7 |
| limitations | No standalone ctx7 executable is on PATH. The CLI package is MIT. Context7 Node.js documentation is available only through v25 while the observed runtime is v26.5.0, so v26-specific behavior requires additional primary-source verification. |
| task_id | PRG-CTX7-001 |

## Retrieved documentation evidence

### Node.js cryptography

| field | value |
|---|---|
| library | Node.js |
| library_id | /nodejs/node |
| installed_version | runtime v26.5.0; Context7 documentation through v25 |
| query | crypto timingSafeEqual, hashing, and random UUID behavior and safety constraints |
| retrieved_at | 2026-07-19T02:34:57Z |
| documentation_summary | crypto.timingSafeEqual compares equal-length byte sequences using a constant-time algorithm, but surrounding code must also avoid timing leaks. Hash availability depends on the linked OpenSSL build. crypto.randomUUID produces RFC 4122 version 4 UUIDs with cryptographic randomness and may use an entropy cache. |
| implementation_decision | Compare fixed-length token digests rather than variable-length secrets; reject length mismatch before timingSafeEqual without exposing secret-dependent behavior. Use explicit supported hash algorithms and randomUUID for non-sequential identifiers where the domain permits. |
| source_links | https://github.com/nodejs/node/blob/main/doc/api/crypto.md |
| limitations | Context7 documentation stops at Node v25 while the observed runtime is v26.5.0. Reconfirm any v26-specific API or behavior in the matching Node v26 primary documentation before implementation. |
| task_id | WS07-ID-001 |

### PostgreSQL row-level security

| field | value |
|---|---|
| library | PostgreSQL current |
| library_id | /websites/postgresql_current |
| installed_version | deployment version not yet established |
| query | row-level security default deny, policy enforcement, table-owner bypass, FORCE ROW LEVEL SECURITY, USING, and WITH CHECK |
| retrieved_at | 2026-07-19T02:34:57Z |
| documentation_summary | When row security is enabled and no applicable policy exists, access is default-deny. Table owners normally bypass row security unless FORCE ROW LEVEL SECURITY is enabled, and roles with BYPASSRLS bypass it. Policies control visible rows with USING and accepted writes with WITH CHECK. |
| implementation_decision | Enable and force RLS for tenant-owned tables, use explicit USING and WITH CHECK policies, keep application roles free of BYPASSRLS, and test owner/bypass behavior plus cross-tenant denial. |
| source_links | https://www.postgresql.org/docs/current/ddl-rowsecurity.html |
| limitations | The deployed PostgreSQL version and complete tenant-table inventory remain to be established. Current-version documentation must be re-resolved against the deployed version before the gate passes. |
| task_id | WS07-ID-001 |

### OpenAPI 3.1.1 bearer security and reusable schemas

| field | value |
|---|---|
| library | OpenAPI Specification 3.1.1 |
| library_id | /oai/openapi-specification/3.1.1 |
| installed_version | target contract version 3.1.1 |
| query | bearer authentication in components/securitySchemes, operation security requirements, reusable components, and JSON Schema integration |
| retrieved_at | 2026-07-19T02:34:57Z |
| documentation_summary | Reusable security schemes live under components/securitySchemes. HTTP bearer authentication uses type http and scheme bearer, with bearerFormat as an optional hint. Security requirements apply schemes globally or per operation. OpenAPI 3.1 Schema Objects align with the declared JSON Schema dialect. |
| implementation_decision | Define a reusable bearer security scheme, apply security explicitly at the global or operation level, and reference reusable strict request/response schemas from components. Document any intentionally unauthenticated operation explicitly. |
| source_links | https://github.com/OAI/OpenAPI-Specification/blob/3.1.1/versions/3.1.1.md |
| limitations | The repository contract inventory and generated-spec validation remain pending; documentation evidence alone does not prove contract conformance. |
| task_id | WS08-INT-001 |

### JSON Schema strict object validation

| field | value |
|---|---|
| library | Understanding JSON Schema |
| library_id | /websites/json-schema_understanding-json-schema |
| installed_version | OpenAPI 3.1.1 JSON Schema dialect target; validator implementation not yet established |
| query | strict object validation with properties, required, additionalProperties, and composed schemas |
| retrieved_at | 2026-07-19T02:34:57Z |
| documentation_summary | Declaring properties does not make them required and does not reject undeclared properties. required lists mandatory names; additionalProperties false closes an object at that schema boundary. Composition can require unevaluatedProperties or deliberate schema structure to avoid accidental gaps. |
| implementation_decision | Declare required fields explicitly, reject unexpected fields for closed API objects, apply the same rule to nested objects, and test composition boundaries rather than assuming strictness. |
| source_links | https://json-schema.org/understanding-json-schema/reference/object |
| limitations | Exact validator and draft support must be confirmed before relying on unevaluatedProperties or composition behavior. |
| task_id | WS08-INT-001 |

### Ajv 8 strict OpenAPI validation

| field | value |
|---|---|
| library | Ajv |
| library_id | /ajv-validator/ajv/v8.17.1 |
| installed_version | implementation selection: ajv 8.20.0 and ajv-formats 3.0.1 |
| query | Ajv2020 strict allErrors addSchema |
| retrieved_at | 2026-07-19T02:48:59Z |
| documentation_summary | Ajv2020 targets JSON Schema 2020-12. Strict mode turns ambiguous or ignored schema constructs into failures, allErrors collects all validation failures instead of stopping at the first, and addSchema registers reusable schemas by key or schema identifier before compilation. ajv-formats supplies standard format validators separately from core Ajv. |
| implementation_decision | Build the contract validator with Ajv2020, strict mode, allErrors, and ajv-formats; register the complete reusable schema set with addSchema before compiling request and response validators. Treat schema registration, dialect, and compilation failures as build/test failures. |
| source_links | https://ajv.js.org/json-schema.html#draft-2020-12 ; https://ajv.js.org/options.html ; https://ajv.js.org/guide/combining-schemas.html |
| limitations | Context7 evidence is pinned to Ajv v8.17.1 while implementation selected ajv 8.20.0 and ajv-formats 3.0.1. Compatibility and any changed defaults or strict-mode behavior must be verified against 8.20.0 before the contract gate passes. |
| task_id | WS08-CONTRACT-FOUNDATION-001 |

### Docker production-image foundation

| field | value |
|---|---|
| library | Docker documentation |
| library_id | /docker/docs |
| installed_version | local client and engine 28.5.1; runtime base selected as node:24.12.0-bookworm-slim |
| query | Dockerfile multi-stage build, non-root USER, and HEALTHCHECK guidance |
| retrieved_at | 2026-07-19T03:47:35Z |
| documentation_summary | Docker's primary documentation describes multi-stage builds for separating build-time content from the final image, USER for changing the runtime identity, and HEALTHCHECK for declaring an in-container health probe. |
| implementation_decision | Use explicit build, production-dependency, and runtime stages; copy only compiled output plus required v1 contract artifacts; run as the image's non-root node user; and probe the public health endpoint without embedding credentials. |
| source_links | https://docs.docker.com/build/building/multi-stage/ ; https://docs.docker.com/reference/dockerfile/#user ; https://docs.docker.com/reference/dockerfile/#healthcheck |
| limitations | A local Docker build passed, but the image has not been scanned, signed, published, deployed, or exercised under a production orchestrator. The production platform and immutable base-image digest remain human decisions. |
| task_id | WS10-OPS-FOUNDATION-001 |

### PostgreSQL logical backup and restore foundation

| field | value |
|---|---|
| library | PostgreSQL current |
| library_id | /websites/postgresql_current |
| installed_version | production version not selected; local disposable security gate uses PostgreSQL 16 |
| query | pg_dump custom-format backup, pg_restore isolated restore, archive listing, and verification guidance |
| retrieved_at | 2026-07-19T03:47:35Z |
| documentation_summary | PostgreSQL documents custom-format logical dumps as archives intended for pg_restore, archive listing and selective restore behavior, and transaction options for restoring into a target database. pg_verifybackup applies to physical base backups, not to the logical custom-format procedure selected here. |
| implementation_decision | Define credential-file-based custom-format backups and restores into an isolated target, require archive inspection and application-level verification, and forbid restore tests over the active production database. |
| source_links | https://www.postgresql.org/docs/current/app-pgdump.html ; https://www.postgresql.org/docs/current/app-pgrestore.html |
| limitations | No production database, backup destination, retention schedule, encryption/KMS design, RPO/RTO, physical-backup/PITR plan, or completed restore drill exists. This is procedure evidence only. |
| task_id | WS10-OPS-FOUNDATION-001 |

### pgvector disposable security-gate runtime

| field | value |
|---|---|
| library | pgvector |
| library_id | /pgvector/pgvector |
| installed_version | disposable gate image pgvector/pgvector:0.8.5-pg16-bookworm at sha256:1d533553fefe4f12e5d80c7b80622ba0c382abb5758856f52983d8789179f0fb |
| query | pgvector v0.8.5 Docker tags for PostgreSQL 16 and CREATE EXTENSION vector setup |
| retrieved_at | 2026-07-19T03:47:35Z |
| documentation_summary | The pgvector primary repository documents PostgreSQL 13+ support, installation through CREATE EXTENSION vector, and versioned Docker tags that combine pgvector releases with PostgreSQL major versions. |
| implementation_decision | Pin the disposable RLS integration gate to pgvector 0.8.5 on PostgreSQL 16, resolve and record the pulled digest, and create the vector extension before applying repository migrations. Do not treat that local image as the selected production database. |
| source_links | https://github.com/pgvector/pgvector/blob/v0.8.5/README.md ; https://github.com/pgvector/pgvector/releases/tag/v0.8.5 |
| limitations | The test container is local and disposable. Production PostgreSQL/pgvector versioning, HA, backups, monitoring, tuning, query plans, upgrade strategy, and image provenance policy remain unresolved. |
| task_id | WS07-ID-001 |

### Node.js scanner process boundary

| field | value |
|---|---|
| library | Node.js |
| library_id | /nodejs/node |
| installed_version | runtime v26.5.0; Context7 documentation through v25 |
| query | child_process execFile timeout maxBuffer AbortSignal no shell for an untrusted-document malware scanner adapter |
| retrieved_at | 2026-07-19T05:54:37Z |
| documentation_summary | Node documents execFile as direct executable invocation without a shell by default. Its options include timeout and maxBuffer controls; callback failures expose process exit/error state rather than requiring shell parsing. |
| implementation_decision | Invoke only fixed clamdscan or clamscan executables through execFile with shell false, a 120-second default timeout, a 64-KiB output ceiling, and fixed application-owned arguments. Treat missing executables, timeouts, output-limit failures, and unexpected exits as scanner errors that fail closed. |
| source_links | https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback ; https://github.com/nodejs/node/blob/main/doc/api/child_process.md |
| limitations | Context7 stops at Node v25 while the runtime is v26.5.0. The code uses long-standing execFile options and executable tests, but any v26-specific semantic change still requires matching primary documentation. This process boundary does not provide sandboxing or scanner isolation. |
| task_id | WS03-ARTIFACT-SAFETY-001 |

### ClamAV artifact-scanning boundary

| field | value |
|---|---|
| library | ClamAV |
| library_id | /cisco-talos/clamav |
| installed_version | none in the current host runtime or production image; adapter targets reviewed clamdscan or clamscan deployments |
| query | clamscan and clamdscan scanning, exit behavior, file-type magic, encrypted documents, official databases, and scanner size-limit handling |
| retrieved_at | 2026-07-19T05:54:37Z |
| documentation_summary | ClamAV documents clamscan for standalone scans and clamdscan as the client for a running daemon. Its scanning guidance warns that configured size limits affect what is inspected, and its file-type recognition uses byte magic rather than trusting extensions alone. |
| implementation_decision | Require extension, declared MIME, and bounded structural-byte agreement before ClamAV. For standalone clamscan, use official databases and enable archive/PDF, encrypted-document, and exceeds-limit alerts. For clamdscan, require operator-reviewed daemon database and limit policy. Map only a successful clean exit to clean evidence; infection and every infrastructure/error state fail closed. |
| source_links | https://docs.clamav.net/manual/Usage/Scanning.html ; https://docs.clamav.net/manual/Development/libclamav.html ; https://docs.clamav.net/manual/Signatures/FileTypeMagic.html |
| limitations | No ClamAV binary, daemon, signature database, freshness monitor, or production scanner capacity test exists in the current runtime. Therefore the real DMP has no malware verdict and remains acquired only; injected scanner fixtures prove adapter behavior, not real-engine cleanliness. |
| task_id | WS03-ARTIFACT-SAFETY-001 |

## Enforcement policy

For every task in a Context7-required category:

1. Resolve the exact installed dependency or service version from repository or deployment evidence.
2. Use resolve-library-id and query-docs, or the equivalent ctx7 library/docs CLI calls.
3. Add one record below per decision, using immutable task IDs and direct source links.
4. Separate retrieved documentation facts from the implementation decision.
5. Record version mismatches, missing pages, stale documentation, and ambiguity in limitations.
6. Do not mark a technology-dependent task done when its required Context7 record is absent.
7. For legal and municipal sources, use authoritative government or municipal evidence and do not use Context7 as a substitute.

## Pending evidence queue

| task_id | category | library or service | installed version evidence | required query | status | blocker |
|---|---|---|---|---|---|---|
| WS03-ING-001 | PostgreSQL ingestion and idempotency | pg | lockfile pins pg 8.22.0 | Transaction, retry, idempotency, and error handling guidance for the installed node-postgres version | pending | Local artifact safety evidence is complete under WS03-ARTIFACT-SAFETY-001; tenant-scoped database ingestion guidance and implementation remain pending |
| WS04-RET-001 | PostgreSQL and pgvector retrieval | PostgreSQL and pgvector | disposable gate: PostgreSQL 16.14 and pgvector 0.8.5 | Vector index, distance operator, filtering, and query-plan guidance for the selected production versions | in_progress | Local versions are evidence only; production versions and query plans remain unselected |
| WS07-ID-001 | authentication and tenancy | /nodejs/node and /websites/postgresql_current | Node v26.5.0 observed; disposable runtime PostgreSQL 16.14 | Apply retrieved crypto/RLS evidence and verify the selected auth/session architecture | completed_with_limitations | Procedure-query v1 passes local DB/HTTP isolation; production topology and Node v26 doc parity remain pending |
| WS08-CONTRACT-FOUNDATION-001 | API contract foundation | /oai/openapi-specification/3.1.1, /websites/json-schema_understanding-json-schema, and /ajv-validator/ajv/v8.17.1 | OpenAPI 3.1.1; ajv 8.20.0; ajv-formats 3.0.1 | Apply bearer/components/strict-object guidance with Ajv2020 strict, allErrors, and addSchema | completed_with_version_limitation | Executable registry/provider validation passes; Context7 Ajv docs remain v8.17.1 rather than 8.20.0 |
| WS10-OPS-001 | cloud, Terraform, observability, security | to be discovered | no deployment/IaC version evidence established by this audit | Provider-specific deployment, rollback, logging, metrics, tracing, secrets, backup, and restore guidance | pending | Platform selection pending |
| WS11-QA-001 | testing | Node.js test runner and TypeScript | Node v26.5.0 observed; exact TypeScript/tsx lockfile versions must be confirmed | Test isolation, coverage, failure diagnostics, and security/eval harness guidance | pending | Task-specific query not yet recorded |

## Evidence record template

Copy this section for each resolved decision.

    library:
    library_id:
    installed_version:
    query:
    retrieved_at:
    documentation_summary:
    implementation_decision:
    source_links:
    limitations:
    task_id:

## Version and authority boundary

Context7 is now available, but every record must still name the official publisher, source URL, retrieval time, installed version, and any version mismatch. Context7 evidence does not by itself prove implementation conformance or pass a production gate. Legal and municipal claims continue to require authoritative legal or municipal sources.
