# Context7 evidence register

Last updated: 2026-07-19T02:48:59Z

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
| WS03-ING-001 | PostgreSQL ingestion and idempotency | pg | package.json declares ^8.22.0; exact lockfile version must be confirmed by task owner | Transaction, retry, idempotency, and error handling guidance for the installed node-postgres version | pending | Tool available; task-specific query not yet recorded |
| WS04-RET-001 | PostgreSQL and pgvector retrieval | PostgreSQL and pgvector | PostgreSQL/pgvector runtime versions not yet established | Vector index, distance operator, filtering, and query-plan guidance for the deployed versions | pending | Runtime versions unknown |
| WS07-ID-001 | authentication and tenancy | /nodejs/node and /websites/postgresql_current | Node v26.5.0 observed; PostgreSQL runtime unknown | Extend retrieved crypto and RLS evidence to the selected auth/session architecture | in_progress | Node documentation version mismatch and architecture decision pending |
| WS08-CONTRACT-FOUNDATION-001 | API contract foundation | /oai/openapi-specification/3.1.1, /websites/json-schema_understanding-json-schema, and /ajv-validator/ajv/v8.17.1 | target OpenAPI 3.1.1; selected ajv 8.20.0 and ajv-formats 3.0.1 | Apply bearer/components/strict-object guidance with Ajv2020 strict, allErrors, and addSchema | in_progress | Ajv Context7 docs v8.17.1 must be compatibility-checked against selected package v8.20.0 |
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
