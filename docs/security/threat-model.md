# Threat model

Status: pre-production foundation; security review and production platform selection pending
Last reviewed: 2026-07-18
Scope owner: Product Engineering
Required approvers before production: named Security owner, Privacy/Legal owner, and municipal Product owner (all pending)

## Operational truth

This document is a design-time threat model, not a penetration test, deployment attestation, or certification. No production backend infrastructure, WAF, secret manager, centralized observability stack, on-call integration, or disaster-recovery drill is evidenced in this repository.

The repository now contains backend CI and a container definition. Those artifacts are readiness controls only. They do not prove that an image has been scanned, signed, deployed, or operated. The identity, tenancy, RBAC, RLS, and sanitized-audit foundation is committed with static/unit coverage. Its HTTP enforcement and proof against a real migrated PostgreSQL instance remain in progress; the foundation must pass integration, migration, isolation, and runtime tests before this model credits it as an effective end-to-end production control.

Known exposed or potentially exposed surfaces remain:

- legacy `/api/search`, `/api/evidence`, `/api/procedure`, `/api/agent`, `/api/answer`, and `/api/chat` routes do not enforce tenant-aware authentication;
- `/api/procedure-feedback` uses a single shared Bearer token rather than per-principal RBAC;
- `/health` and static assets are intentionally unauthenticated;
- GitHub Pages is a public static demonstration, not the backend, and has no project-level custom response headers in the current setup;
- the Pages demo can be configured to call an API, but no production API origin has been approved;
- external contracts with OS Electoral and Content Agency are schemas and boundary definitions, not an operational integration.

Until the legacy routes are removed, isolated, or protected, the backend must not be exposed to untrusted networks with confidential, internal, or cross-tenant data.

## System and trust boundaries

```text
Public Internet
  |
  +--> GitHub Pages static demo
  |      no secrets, database, or server-side enforcement
  |
  +--> future TLS ingress / API gateway             [not selected]
             |
             +--> Node.js API container             [image definition only]
                     |
                     +--> PostgreSQL + pgvector      [production service absent]
                     |
                     +--> document/object storage    [production service absent]

OS Electoral / Content Agency
  +--> versioned JSON Schema / HTTP contracts        [runtime adapters absent]
```

Each arrow crosses a trust boundary. CORS, private network placement, source URLs, `tenant_id` fields, and contract `producer` fields are not identities. Authentication and authorization must be established from server-controlled credentials before a tenant-scoped resource is read or changed.

### Boundary inventory

| Boundary | Untrusted input | Required control | Current evidence |
|---|---|---|---|
| Browser -> Pages | URL parameters, DOM data, configured API URL | scheme/origin validation, no secrets, safe links | static hardening tests exist; Pages remains public |
| Client -> API | headers, JSON body, query, tenant/resource IDs | TLS, body bounds, authentication, RBAC, tenant match, rate limits, safe errors | complete control is not yet integrated; legacy routes remain open |
| API -> PostgreSQL | query parameters and principal/tenant context | parameterized SQL, transaction-local tenant context, RLS, least-privilege DB role | migration/repository foundation is committed; real database execution and HTTP enforcement are not yet proven |
| Ingestion -> corpus | bytes, MIME type, filenames, URLs, extracted text | size/type/hash validation, malware policy, provenance, quarantine, human promotion | controlled local import and hashing exist; malware scanning/quarantine service absent |
| API -> logs/audit | identifiers, outcomes, errors | allowlisted fields, redaction, immutable access control, retention | sanitized audit builder is committed; endpoint integration/runtime sink proof and centralized storage are absent |
| Product -> external product | contract envelope and claims | schema validation, authenticated producer, tenant scope, idempotency, provenance | machine contracts exist in development; adapters and runtime proof absent |

## Assets and security objectives

| Asset | Objective |
|---|---|
| Municipal source bytes and versions | integrity, provenance, authority status, reproducible hashes |
| Extracted sections, embeddings, and evidence | tenant confidentiality, source traceability, no silent cross-version substitution |
| Procedure drafts, approvals, cases, and feedback | authorized lifecycle changes, separation of duties, auditability |
| Credentials and integration identities | confidentiality, rotation, revocation, no plaintext persistence or logging |
| Tenant and principal identifiers | correct binding and non-enumerability across tenants |
| Audit and idempotency records | integrity, safe minimization, sufficient incident evidence |
| Contract payloads and ClaimPacks | schema integrity, producer authenticity, version/provenance preservation |
| Build and container artifacts | reproducibility, provenance, vulnerability management, immutable release identity |

LA Muni RAG is not an owner or storage system for internal campaign strategy, voter/segment data, electoral CRM records, editorial calendars, paid-media plans, or Content Agency production assets. Such data must be refused or reduced to the minimum approved opaque external reference; it must not enter the corpus, prompts, logs, analytics, or backups.

## Threat actors

- anonymous Internet clients scanning public endpoints;
- authenticated principals exceeding their role or tenant scope;
- compromised integration credentials or replaying clients;
- malicious or mistaken operators importing poisoned documents;
- upstream publishers serving changed or hostile files at previously trusted URLs;
- dependency, build-runner, container-registry, or base-image compromise;
- insiders with database, backup, logging, or cloud-console access;
- prompt-injection content embedded in municipal documents;
- automated scrapers creating denial-of-service or cost exhaustion.

## STRIDE analysis

| Class | Representative threat | Existing or planned control | Residual risk / required action |
|---|---|---|---|
| Spoofing | Client declares another `tenant_id`, role, or producer in JSON | server-derived principal; credential digest lookup; tenant/permission guard | foundation is committed; HTTP enforcement, rotation, expiry, revocation, and real-database negative tests remain required |
| Spoofing | Forged OS Electoral or Content Agency payload | Bearer/service identity plus versioned schema | adapters and mutual producer verification are absent; contract validity alone is not authenticity |
| Tampering | Source document changes without a version transition | SHA-256, source/version IDs, controlled import | remote reacquisition policy, malware scanning, and signed provenance are unresolved |
| Tampering | Workflow/approval or ClaimPack modified after review | immutable version IDs, approval state, audit event | persistent approval lifecycle is not complete; never label a draft approved from client input |
| Tampering | Build dependency or base image compromised | lockfile, `npm ci`, explicit Node image version, separated CI | digest pinning, SBOM, signature verification, registry policy, and dependency scanning remain pending |
| Repudiation | Operator denies a query, import, approval, or denial | correlation/request IDs and sanitized audit events | centralized append-only audit store, clock guarantees, access review, and retention are absent |
| Information disclosure | Cross-tenant search or direct object reference | tenant-bound authorization plus PostgreSQL RLS | highest current risk: legacy routes and global queries remain; block production exposure until isolated |
| Information disclosure | Secrets, queries, case context, or PII leak in errors/logs | safe error envelopes and allowlisted audit metadata | legacy error/log review and centralized redaction verification are still required |
| Information disclosure | Public Pages artifact includes confidential source or token | static-only build, ignored environment files, secret-free client | artifact inspection must remain a release gate; Pages can only contain public demonstration data |
| Denial of service | Large body, expensive hybrid query, retry storm, or scraper | body/limit validation, rate limit, timeout, idempotency | global enforcement and infrastructure quotas are not yet demonstrated |
| Denial of service | Database pool exhaustion or slow vector query | bounded pool/query timeout, health/metrics, capacity alert | limits, SLOs, load test, autoscaling, and alerts are not selected or validated |
| Elevation of privilege | App/database owner bypasses RLS | least-privilege runtime DB role, `FORCE ROW LEVEL SECURITY`, no `BYPASSRLS` | provisioning and runtime proof are absent; table owner must not be the application role |
| Elevation of privilege | Shared feedback token enables broad read/write | migrate to per-principal permission checks | shared token remains a transitional control and must not be treated as production RBAC |

## Priority abuse cases

### TM-01: cross-tenant query

An authenticated client submits its own credential with another tenant's UUID or a resource ID learned elsewhere. Authorization must fail before retrieval, return the same safe denial shape regardless of resource existence, and record only sanitized identifiers/outcome. No global fallback query is allowed. This is a production blocker until an end-to-end test proves the database and application layers both deny it.

### TM-02: legacy unauthenticated data extraction

An anonymous client enumerates legacy search, evidence, procedure, agent, answer, or chat routes. Network isolation is not a sufficient long-term fix. Before production data is present, routes must be removed, protected with the v1 policy, or bound to a demonstrably public-only dataset and separately rate-limited. Current status: open risk.

### TM-03: prompt injection in an official-looking document

Imported text instructs the model or workflow compiler to ignore policy, invent citations, or exfiltrate context. Extracted text is evidence data, never executable policy. Retrieval must preserve provenance and authority, generation must remain constrained, and results must expose contradictions/gaps rather than follow embedded instructions. Malware and adversarial-corpus evaluation remain pending.

### TM-04: source poisoning or version substitution

An operator imports a file from an unofficial URL, or an official URL later serves different bytes. Import must capture bytes, SHA-256, MIME, acquisition time, authority class, and an immutable version. Promotion to official/active needs human review. A URL alone never proves authenticity.

### TM-05: replay or idempotency collision

A client repeats a POST or reuses a key with a different payload. The server must scope the key by authenticated principal, tenant, and operation; replay the stored result only for the same canonical fingerprint; and return a safe conflict otherwise. Storage and concurrent-race behavior still require runtime proof.

### TM-06: boundary-violating electoral request

A caller asks LA Muni RAG to generate campaign strategy, voter segmentation, political messaging, or a content calendar. The service must refuse the out-of-scope work and may return only approved procedural evidence. It must not store the internal electoral context in the corpus or logs.

### TM-07: denial-of-wallet and resource exhaustion

Automated clients send large bodies, high limits, repeated hybrid searches, or embedding requests. Enforce byte limits before parsing, per-tenant/principal rate limits before expensive work, database statement timeouts, queue limits, and infrastructure caps. Load thresholds and alerting are pending platform selection.

### TM-08: backup or support-channel disclosure

A valid operator copies a production dump, query body, token, or confidential document into a ticket or local machine. Backups must be encrypted, access-logged, tenant-protected, and restored only into an approved isolated environment. Support artifacts must use sanitized IDs and approved secure transfer.

## Security requirements before a production approval

1. Select and document the runtime platform, ingress, secret manager, registry, database roles, log sink, and on-call ownership.
2. Close or protect every legacy route; prove authentication, RBAC, tenant matching, default-deny RLS, and non-leaking errors end to end.
3. Run contract, isolation, migration, dependency, container, secret, and adversarial-input checks in an approved pipeline.
4. Pin the released image by digest and retain build provenance; review base/dependency findings with a named owner.
5. Define log/audit fields and retention, then verify that queries, case bodies, credentials, and cross-product payloads are not recorded.
6. Set body/query/time/rate/concurrency limits and validate them with load and abuse testing.
7. Complete the privacy review decisions, backup RPO/RTO, restore drill, rollback rehearsal, incident roster, and alert routing.
8. Obtain explicit human approval. A green CI run must never trigger backend production deployment by itself.

## Reference evidence used for this foundation

On 2026-07-18, Context7 CLI resolved `/nodejs/node` (Node.js primary repository documentation) for `HTTP server SIGTERM graceful shutdown process signals production`. The returned primary references were Node's `process` and `http` documentation, which document signal listeners and `server.close()` behavior. This supports the shutdown and health expectations in the deployment runbook; it does not prove the service has been exercised under a production orchestrator.

Docker and PostgreSQL queries and their primary references are recorded in the deployment and backup/restore runbooks respectively.

## Review triggers

Re-run this threat model when an endpoint, tenant/role, data classification, ingestion path, model/provider, external adapter, storage service, deployment platform, or public origin changes; after a security incident; and before the first production approval.
