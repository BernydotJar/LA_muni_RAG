# Context7 evidence register

Last updated: 2026-07-19T20:37:54Z

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

### Ajv output-specific response and replay validation

| field | value |
|---|---|
| library | Ajv |
| library_id | /ajv-validator/ajv/v8.17.1 |
| installed_version | ajv 8.20.0; ajv-formats 3.0.1 |
| query | Ajv2020 validating oneOf response variants and selecting validators by requested output; strict validation and separate compiled schemas |
| retrieved_at | 2026-07-21T07:05:00Z |
| documentation_summary | Ajv2020 is the dedicated JSON Schema 2020-12 validator. Strict mode and allErrors are explicit options. `oneOf` validates alternatives, while discriminator-based shortcut selection requires opt-in and a discriminator property. Composition with closed objects must be tested deliberately. |
| implementation_decision | Keep independently compiled strict validators for EvidenceBundle and ProcedureWorkflow, select the validator from the authenticated request's `requested_output`, and revalidate stored idempotent bytes with the same selected schema before replay. Do not enable Ajv discriminator or mutate data during validation. |
| source_links | https://github.com/ajv-validator/ajv/blob/v8.17.1/docs/json-schema.md ; https://github.com/ajv-validator/ajv/blob/v8.17.1/docs/faq.md ; https://github.com/ajv-validator/ajv/blob/master/lib/2020.ts |
| limitations | Context7 evidence is pinned to Ajv 8.17.1 while the lockfile uses 8.20.0. Executable schema compilation and provider tests are the conformance evidence; documentation alone does not prove 8.20.0 behavior. |
| task_id | WS08-OS-INTEGRATION-001 |

### OpenAPI multiple implemented response variants

| field | value |
|---|---|
| library | OpenAPI Specification 3.1.1 |
| library_id | /oai/openapi-specification/3.1.1 |
| installed_version | target contract version 3.1.1 |
| query | operation response content schema oneOf multiple JSON response variants OpenAPI 3.1.1 |
| retrieved_at | 2026-07-21T07:05:00Z |
| documentation_summary | A response schema can use `oneOf` to require exactly one of several response shapes. Without a discriminator, validators evaluate the alternatives. The response contract should list only payloads that the operation can actually return successfully. |
| implementation_decision | The procedure-query 200 response lists exactly EvidenceBundle and ProcedureWorkflow. ProcedureAssessment is excluded from the success union and remains a structured 503 until implemented. Both implemented schemas use distinct `response_type` constants, so the oneOf alternatives are unambiguous. |
| source_links | https://github.com/OAI/OpenAPI-Specification/blob/3.1.1/versions/3.1.1.md |
| limitations | The retrieved Context7 examples were drawn from earlier OpenAPI 3.0.x text within the 3.1.1 library. The repository's OpenAPI 3.1.1 document and JSON Schema registry are validated executably; Context7 examples are design guidance, not conformance proof. |
| task_id | WS08-OS-INTEGRATION-001 |

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

### PDF.js binary document loading and text extraction

| field | value |
|---|---|
| library | Mozilla PDF.js |
| library_id | /mozilla/pdf.js |
| installed_version | exact direct pdfjs-dist 6.1.200; exact direct Node native companion @napi-rs/canvas 1.0.2; production Node base 24.12.0 |
| query | getDocument Uint8Array getTextContent cleanup useWorkerFetch useWasm stopAtErrors |
| retrieved_at | 2026-07-19T07:07:41Z |
| documentation_summary | Context7's official-repository snippets show getDocument accepting binary data, normalize Buffer-like input to Uint8Array for the Node API, expose numPages, and extract per-page text with getPage plus getTextContent. The data buffer may be transferred/taken over by an internal worker, so callers should not assume the supplied view remains reusable. |
| implementation_decision | Copy stdin bytes into a Uint8Array owned by the extraction child, call getDocument with data rather than a path or URL, process pages sequentially through getTextContent, and emit only a strict bounded JSON result. Disable worker fetch, WebAssembly, image decoding, font face/system fonts, and XFA; require stopAtErrors; provide only application-owned local CMap/font/ICC roots. Destroy the loading task in a finally path. Keep the parent-side child-process timeout, output, protocol, and capacity controls authoritative. |
| source_links | https://github.com/mozilla/pdf.js/blob/master/src/display/api.js ; https://github.com/mozilla/pdf.js/blob/master/src/display/api_utils.js ; https://github.com/mozilla/pdf.js/blob/master/test/unit/api_spec.js ; https://www.npmjs.com/package/pdfjs-dist/v/6.1.200 |
| limitations | Context7 resolved current PDF.js repository snippets rather than immutable 6.1.200 documentation, and an older v3_6_172 documentation corpus was the only versioned Context7 alternative. Exact package metadata and executable tests therefore provide the version-specific check. PDF.js requires a native canvas addon in this Node environment, and neither the library nor the Node permission model supplies a complete OS sandbox, network namespace, seccomp profile, or total native-memory bound. Parser upgrades may change normalized text and hashes. |
| task_id | WS03-PDF-EXTRACTION-001 |

### node-postgres transaction-bound clients

| field | value |
|---|---|
| library | node-postgres |
| library_id | /brianc/node-postgres |
| installed_version | exact direct pg 8.22.0, confirmed by package lock and npm ls pg --depth=0 |
| query | node-postgres Pool connect transaction same client BEGIN COMMIT ROLLBACK release error |
| retrieved_at | 2026-07-19T20:37:54Z |
| documentation_summary | The official node-postgres transaction guidance requires every statement in a transaction to use the same checked-out client. It explicitly warns that pool.query cannot be used for transaction statements because PostgreSQL scopes a transaction to one client connection. Transaction control is issued directly with BEGIN, COMMIT, and ROLLBACK. |
| implementation_decision | Make the tenant transaction helper the only database entry point for job/vector operations, bind the tenant context with SET LOCAL on the checked-out client, and keep every statement through commit or rollback on that client. Preserve the original operation error, attempt rollback, and destroy rather than reuse a client whose rollback fails. Perform embedding-provider work before opening the database transaction. |
| source_links | https://node-postgres.com/features/transactions ; https://github.com/brianc/node-postgres/tree/master/packages/pg |
| limitations | Context7 resolved the current official node-postgres repository/docs rather than an immutable pg 8.22.0 manual. Exact-version unit and PostgreSQL integration tests provide the conformance evidence. This transaction discipline does not supply worker admission, provider deadlines, database HA, or production pool sizing. |
| task_id | WS03-TENANT-INGESTION-001 |

### PostgreSQL conflict and queue locking semantics

| field | value |
|---|---|
| library | PostgreSQL current |
| library_id | /websites/postgresql_current |
| installed_version | disposable verification runtime PostgreSQL 16.14 with pgvector 0.8.5; production version unselected |
| query | INSERT ON CONFLICT unique index atomic outcome SELECT FOR UPDATE SKIP LOCKED queue row locks statement_timestamp |
| retrieved_at | 2026-07-19T20:37:54Z |
| documentation_summary | PostgreSQL documents ON CONFLICT against unique constraints/indexes as the concurrency-safe alternative to a check-then-insert race. Row-level FOR UPDATE locks block conflicting writers; SKIP LOCKED intentionally provides an inconsistent general view but is suitable for queue-like consumers that should skip already claimed rows. statement_timestamp reports the start of the current statement. |
| implementation_decision | Back digest idempotency and tenant-wide work identity with unique indexes plus ON CONFLICT/re-read logic. Claim ready jobs in a transaction with FOR UPDATE SKIP LOCKED, issue an opaque lease token, and require that token and unexpired lease on every mutation. Let PostgreSQL assign indexed_at with statement_timestamp. Prelock conflicting vector rows and commit vector replacement, document/job state, and audit atomically. |
| source_links | https://www.postgresql.org/docs/current/sql-insert.html ; https://www.postgresql.org/docs/current/sql-select.html ; https://www.postgresql.org/docs/current/explicit-locking.html ; https://www.postgresql.org/docs/current/functions-datetime.html |
| limitations | The disposable runtime proves PostgreSQL 16.14 behavior only. Production versions, partition/index design, query plans, lock duration, pool limits, HA/failover, backup/restore, upgrade/rollback, and load thresholds remain unselected or unproved. SKIP LOCKED is used only for queue claims, not for authoritative user-facing reads. |
| task_id | WS03-TENANT-INGESTION-001 |

### Node.js HTTP request streams and early rejection lifecycle

| field | value |
|---|---|
| library | Node.js |
| library_id | /nodejs/node |
| installed_version | local runtime v26.5.0; CI and production image Node 24.12.0 |
| query | IncomingMessage request body as a Readable stream; delaying consumption until authentication; unconsumed paused streams, keep-alive reuse, socket close, and bounded early rejection |
| retrieved_at | 2026-07-20T00:42:55Z |
| documentation_summary | Node documents server-side IncomingMessage as a Readable stream separate from the underlying socket so keep-alive connections can carry sequential messages. Readable streams generally remain paused until the application establishes a consumption or discard mechanism. Current Node server source ties IncomingMessage abort state to request/socket close and aborts queued incoming messages when the socket closes. |
| implementation_decision | Do not attach body data listeners until Bearer authentication and the per-operation rate gate finish. Once admitted, use the existing 16-KiB draining JSON reader. When authentication, permission, admission, request-id, idempotency, or content-type fails before a framed body is consumed, set ServerResponse.shouldKeepAlive false and return Connection: close rather than draining attacker-controlled bytes or reusing a paused request. Reject framed bodies on GET under the same rule. |
| source_links | https://nodejs.org/api/http.html#class-httpincomingmessage ; https://nodejs.org/api/stream.html#readable-streams ; https://github.com/nodejs/node/blob/main/lib/_http_incoming.js ; https://github.com/nodejs/node/blob/main/lib/_http_server.js |
| limitations | Context7 returned current-main source and documentation rather than immutable Node 24.12.0 and 26.5.0 pages. Exact local/CI HTTP tests cover both runtime lines, including a raw body-bearing GET, but no ingress/load/slow-client capacity gate or fleet-level connection metric exists. |
| task_id | WS03-INGESTION-API-WORKER-001 |

### PostgreSQL ingestion API rate state and tenantless audit function

| field | value |
|---|---|
| library | PostgreSQL current |
| library_id | /websites/postgresql_current |
| installed_version | disposable verification runtime PostgreSQL 16.14 with pgvector 0.8.5; production version unselected |
| query | SECURITY DEFINER functions with safe fixed search_path and revoked PUBLIC execution; forced row security; INSERT ON CONFLICT counters |
| retrieved_at | 2026-07-20T00:42:55Z |
| documentation_summary | PostgreSQL requires SECURITY DEFINER functions to exclude untrusted writable schemas from search_path and recommends placing pg_temp last when unqualified relations are resolved. New functions receive PUBLIC execute by default, so PostgreSQL recommends revoking that access and granting narrowly within the creation transaction. Row-security examples pair ENABLE ROW LEVEL SECURITY with explicit USING/WITH CHECK policies; existing task evidence covers FORCE RLS and ON CONFLICT concurrency semantics. |
| implementation_decision | Keep per-tenant/principal/operation rate counters in a forced-RLS table using a tenant-leading key and atomic ON CONFLICT increment. Keep anonymous authentication decisions in a separate fully revoked aggregate. Its SECURITY DEFINER function has a fixed trusted search_path, schema-qualifies every table reference, accepts only UUID correlation plus an allowlisted reason, deletes expired aggregates, and has PUBLIC execute revoked in the same migration transaction. |
| source_links | https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY ; https://www.postgresql.org/docs/current/ddl-rowsecurity.html ; https://www.postgresql.org/docs/current/sql-insert.html |
| limitations | The function deliberately resolves no unqualified relation; any future change must preserve schema qualification or explicitly position pg_temp last. The disposable runtime proves PostgreSQL 16.14 only. Production grants, version/topology, migration ledger, traffic/retention capacity, HA/failover, and continuous RLS attestation remain unproved. |
| task_id | WS03-INGESTION-API-WORKER-001 |

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
| WS03-ING-001 | PostgreSQL ingestion, idempotency, and Node HTTP admission | /brianc/node-postgres, /websites/postgresql_current, and /nodejs/node | pg 8.22.0; disposable PostgreSQL 16.14/pgvector 0.8.5; local Node 26.5.0 and CI/image Node 24.12.0 | Transaction-bound jobs/vectors, concurrent idempotency/locking/fencing, authenticated API admission/audit, and early request-stream lifecycle | completed_with_limitations | WS03-TENANT-INGESTION-001 and WS03-INGESTION-API-WORKER-001 are verified locally/remotely; the parent still needs real scanner/storage, source administration, a running worker, production topology, quotas/monitoring, load/HA, and deployment evidence |
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
