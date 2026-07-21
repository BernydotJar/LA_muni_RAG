# Threat model

Status: pre-production foundation; security review and production platform selection pending
Last reviewed: 2026-07-19
Scope owner: Product Engineering
Required approvers before production: named Security owner, Privacy/Legal owner, and municipal Product owner (all pending)

## Operational truth

This document is a design-time threat model, not a penetration test, deployment attestation, or certification. No production backend infrastructure, WAF, secret manager, centralized observability stack, on-call integration, or disaster-recovery drill is evidenced in this repository.

The repository now contains backend CI, a container definition, the
authenticated procedure provider, and authenticated ingestion enqueue/status
routes. Static tests plus disposable PostgreSQL 16.14/pgvector 0.8.5 gates
exercised fresh/supported migration chains, a non-owner/non-`BYPASSRLS` role,
tenant A/B isolation, audit/idempotency/rate state, and real HTTP decisions. That
is effective local evidence for these routes; it is not an image scan/signature, staging test, production role attestation, load test, deployment, or external-consumer proof.

The local document-library path now validates size, extension, MIME and byte
signature; exposes a fail-closed fixed-argument ClamAV adapter; quarantines
applied failures; and refuses extraction without matching current clean evidence.
ClamAV receives a private verified snapshot rather than the mutable managed path.
Accepted raw PDF bytes are parsed once in a bounded child process with strict
byte/time/page/text/channel/concurrency policy, then the normalized document is
passed to indexing without a path reread or second parse. Adversarial tests cover
ABA path mutation, snapshot tamper, corrupt/text-free PDFs, timeouts, output
floods, and protocol corruption. No ClamAV executable/service is installed in the
current runtime, so the DMP has not received a malware verdict and remains only
`acquired`; Feature 055 did not parse or index it.

The tenant ingestion core now persists digest-bound jobs and job-bound vectors,
claims work with bounded leases and stale-worker fencing, and atomically replaces
one complete document generation with version/job/audit state. The authenticated
API accepts only existing version/hash identities under a server-owned pipeline.
A callable worker requires an injected immutable object generation and current
clean evidence, copies/verifies the exact bytes, heartbeats, rehashes after
parsing, and reuses fenced atomic completion. Disposable non-owner SQL/service/
HTTP gates exercised these paths with synthetic records. There is still no
deployed worker, durable object storage/scanner adapter, production role
attestation, load/HA proof, or DMP ingestion.

Known exposed or potentially exposed surfaces remain:

- legacy `/api/search`, `/api/evidence`, `/api/procedure`, `/api/agent`, `/api/answer`, `/api/chat`, and `/api/procedure-feedback` do not enforce the v1 tenant policy when explicitly enabled outside production;
- `NODE_ENV=production` disables all pre-v1 `/api/*` routes before wildcard CORS; configuration regression or deliberate re-enablement would reopen this risk;
- `/health` and static assets are intentionally unauthenticated;
- GitHub Pages is a public static demonstration, not the backend, and has no project-level custom response headers in the current setup;
- the Pages demo can be configured to call an API, but no production API origin has been approved;
- the `ProcedureWorkflow`, `EvidenceBundle`, and `ClaimPack` providers exist locally, but OS Electoral/Content Agency consumers, remote ClaimPack database evidence, and the remaining artifacts are not an operational integration.

The production artifact must retain the tested legacy-route gate. Development/legacy mode must not be exposed to untrusted networks with confidential, internal, or cross-tenant data.

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
                     +--> ingestion worker           [callable class only]
                              |
                              +--> document/object storage [adapter/service absent]

OS Electoral / Content Agency
  +--> EvidenceBundle / ProcedureWorkflow providers  [local providers tested]
  +--> ClaimPack provider                            [local provider tested; remote DB gate pending]
  +--> external consumers / remaining contracts      [adapters absent]
```

Each arrow crosses a trust boundary. CORS, private network placement, source URLs, `tenant_id` fields, and contract `producer` fields are not identities. Authentication and authorization must be established from server-controlled credentials before a tenant-scoped resource is read or changed.

### Boundary inventory

| Boundary | Untrusted input | Required control | Current evidence |
|---|---|---|---|
| Browser -> Pages | URL parameters, DOM data, configured API URL | scheme/origin validation, no secrets, safe links | static hardening tests exist; Pages remains public |
| Client -> API | headers, JSON body, query, tenant/resource IDs | TLS, body bounds, authentication, RBAC, tenant match, rate limits, safe errors | implemented/tested for procedure-query, ClaimPack, and ingestion-job v1; TLS/ingress and the remaining API catalog are absent; legacy is production-disabled |
| API -> PostgreSQL | query parameters and principal/tenant context | parameterized SQL, transaction-local tenant context, RLS, least-privilege DB role | disposable real-DB/HTTP gates pass for procedure-query and ingestion; ClaimPack SQL/HTTP gates are wired but remote execution for this HEAD is pending; production provisioning, statement limits, HA and monitoring are absent |
| Ingestion -> corpus | bytes, MIME type, filenames, URLs, extracted text | size/type/hash validation, malware policy, provenance, parser isolation, resource bounds, quarantine, durable leases, tenant vectors, human promotion | local signature/MIME gate, private-snapshot ClamAV adapter, bounded raw-PDF child, authenticated job API, accepted-artifact worker boundary, rollback/replacement and pre-extraction enforcement are tested; real scanner/storage adapter, deployed worker, approved OS sandbox, load/HA and human promotion are absent |
| API -> logs/audit | identifiers, outcomes, errors | allowlisted fields, redaction, immutable access control, retention | both v1 families persist allowlisted tenant audit and bounded route-specific tenantless auth aggregates; centralized append-only storage/access review remain absent |
| Product -> external product | contract envelope and claims | schema validation, authenticated producer, tenant scope, idempotency, provenance, expiry | local EvidenceBundle, ProcedureWorkflow, and ClaimPack providers are tested; consumer identity/interoperability, cross-product revocation, and remaining adapters are absent |

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
| Spoofing | Client declares another `tenant_id`, role, or producer in JSON | server-derived principal; credential digest lookup; tenant/permission guard | v1 HTTP and real-DB negative tests pass; production credential provisioning/rotation and other endpoints remain required |
| Spoofing | Forged OS Electoral or Content Agency payload | Bearer/service identity plus versioned schema | adapters and mutual producer verification are absent; contract validity alone is not authenticity |
| Tampering | Source document changes without a version transition | SHA-256, source/version IDs, controlled import, observed-vs-expected quarantine evidence | remote reacquisition policy, signed provenance, durable storage and cross-process locking are unresolved |
| Tampering | Workflow/approval or ClaimPack modified after review | immutable version IDs, approval state, audit event | persistent approval lifecycle is not complete; never label a draft approved from client input |
| Tampering | Build dependency or base image compromised | lockfile, `npm ci`, explicit Node image version, separated CI | digest pinning, SBOM, signature verification, registry policy, and dependency scanning remain pending |
| Repudiation | Operator denies a query, import, approval, or denial | correlation/request IDs and sanitized audit events | centralized append-only audit store, clock guarantees, access review, and retention are absent |
| Information disclosure | Cross-tenant search or direct object reference | tenant-bound authorization plus PostgreSQL RLS | v1 gate passes and production disables legacy routes; guard `NODE_ENV`, protect future routes, and repeat in staging/production topology |
| Information disclosure | Secrets, queries, case context, or PII leak in errors/logs | safe error envelopes and allowlisted audit metadata | legacy error/log review and centralized redaction verification are still required |
| Information disclosure | Public Pages artifact includes confidential source or token | static-only build, ignored environment files, secret-free client | artifact inspection must remain a release gate; Pages can only contain public demonstration data |
| Denial of service | Large body, expensive hybrid query, retry storm, or scraper | body/limit validation, per-principal rate limit, server timeouts, idempotency | v1 behavior is tested; load thresholds, DB statement timeout, ingress quotas and global enforcement are not demonstrated |
| Denial of service | Pathological PDF expands text, stalls parsing, floods channels, or triggers provider fan-out | child-process byte/time/page/text/heap/channel/concurrency bounds; chunk/batch caps; durable attempts/lease/retry bounds; API admission | V8 heap is not total RSS/native memory; attempt-wide cancellation, tenant quotas, queue-depth limits, deployed-worker backpressure and load thresholds are absent |
| Denial of service | Database pool exhaustion or slow vector query | bounded result count; tenant/model predicates; exact search avoids approximate recall loss | statement/pool limits, SLOs, corpus-scale plans/load, partitioning, autoscaling, and alerts are not selected or validated |
| Elevation of privilege | App/database owner bypasses RLS | least-privilege runtime DB role, `FORCE ROW LEVEL SECURITY`, no `BYPASSRLS` | disposable procedure and ingestion non-owner proofs pass; production provisioning/startup/continuous attestation remain absent |
| Elevation of privilege | Shared feedback token enables broad read/write | migrate to per-principal permission checks | shared token remains a transitional control and must not be treated as production RBAC |

## Priority abuse cases

### TM-01: cross-tenant query

An authenticated client submits its own credential with another tenant's UUID or a resource ID learned elsewhere. Authorization must fail before retrieval, return the same safe denial shape regardless of resource existence, and record only sanitized identifiers/outcome. No global fallback query is allowed. The disposable v1 HTTP/database gate passes this case; it must be repeated with the approved production topology and for every future tenant route.

### TM-02: legacy unauthenticated data extraction

An anonymous client enumerates legacy search, evidence, procedure, agent, answer, chat, or feedback routes. The production server now returns a non-CORS 404 for all pre-v1 `/api/*` routes; tests cover the route inventory and preflight. The legacy implementations remain available for development, so environment/config enforcement and regression tests are release controls, not a reason to expose legacy mode.

### TM-03: prompt injection in an official-looking document

Imported text instructs the model or workflow compiler to ignore policy, invent citations, or exfiltrate context. Extracted text is evidence data, never executable policy. Retrieval must preserve provenance and authority, generation must remain constrained, and results must expose contradictions/gaps rather than follow embedded instructions. Malware and adversarial-corpus evaluation remain pending.

### TM-04: source poisoning or version substitution

An operator imports a file from an unofficial URL, or an official URL later serves different bytes. Import must capture bytes, SHA-256, MIME, acquisition time, authority class, and an immutable version. Promotion to official/active needs human review. A URL alone never proves authenticity.

The local workflow now validates extension/MIME/signature on import, requires a
current path/hash/size-bound clean ClamAV verdict before extraction, and moves
applied failures to bounded quarantine without rewriting expected identity. This
workflow scans a private copy of the verified buffer, so an ABA mutation of the
managed path cannot substitute the scanner input. This is executable local
control logic, not proof of a deployed scanner, fresh definitions, object-storage
isolation, decompression-bomb resilience, or human document approval.

### TM-05: replay or idempotency collision

A client repeats a POST or reuses a key with a different payload. The v1 server scopes the digest by principal, tenant, and operation, returns byte-exact replay only after current-contract and identity validation, conflicts on another fingerprint, and deletes/audits corrupt stored bytes. ClaimPack additionally rejects an expired replay and requires regeneration; its local eval covers replay, conflict, corruption wiring, expiry, and retry, while the PostgreSQL gate for this HEAD awaits remote CI. Concurrent load and timeout-race testing remain required.

Ingestion v1 separately binds tenant, principal, document version, artifact,
pipeline, attempt policy, and key digests. The disposable compiled smoke passed
same-request replay, changed-request conflict, duplicate-work collapse, 50
concurrent submissions, and one winner across two claimers. The HTTP API returns
the same durable job for replay/dedup while preserving the current request/audit
correlation. That does not replace distributed load, network-partition, or
production timeout evidence.

### TM-06: boundary-violating electoral request

A caller asks LA Muni RAG to generate campaign strategy, voter segmentation, political messaging, copy, assets, channels, publication tasks, or a content calendar. The service must refuse the out-of-scope work and may return only approved procedural evidence or a bounded ClaimPack. The ClaimPack request is closed and its audit excludes question, facts, briefs, copy, and publication data. Internal electoral/content context must not enter the corpus, ordinary logs, replay state, or backups.

### TM-07: denial-of-wallet and resource exhaustion

Automated clients send large bodies, high limits, repeated hybrid searches, or embedding requests. Enforce byte limits before parsing, per-tenant/principal rate limits before expensive work, database statement timeouts, queue limits, and infrastructure caps. Load thresholds and alerting are pending platform selection.

Raw PDF extraction now rejects inputs above compiled ceilings, processes one page
at a time in a killable child, validates bounded output, caps one process's parser
concurrency, rejects more than 5,000 chunks, and embeds at most 64 texts per
request. Durable jobs cap attempts, lease duration, retry delay, and claims. The
API is callable and rate-limited, but the worker is only a class and is not
deployed. These controls do not provide attempt-wide deadline/cancellation,
tenant quotas, queue-depth backpressure, total RSS/native-memory enforcement, or
an OS network/seccomp sandbox.

### TM-08: backup or support-channel disclosure

A valid operator copies a production dump, query body, token, or confidential document into a ticket or local machine. Backups must be encrypted, access-logged, tenant-protected, and restored only into an approved isolated environment. Support artifacts must use sanitized IDs and approved secure transfer.

## Security requirements before a production approval

1. Select and document the runtime platform, ingress, secret manager, registry, database roles, log sink, and on-call ownership.
2. Preserve the production legacy-route gate and extend the proven v1 authentication, RBAC, tenant matching, default-deny RLS, and non-leaking errors to every new endpoint.
3. Run contract, tenant isolation, migration, dependency, container, secret,
   scanner, parser-abuse, native-memory, and adversarial-input checks in an
   approved pipeline.
4. Pin the released image by digest and retain build provenance; review base/dependency findings with a named owner.
5. Define log/audit fields and retention, then verify that queries, case bodies, credentials, and cross-product payloads are not recorded.
6. Set body/query/time/rate/concurrency limits and validate them with load and abuse testing.
7. Complete the privacy review decisions, backup RPO/RTO, restore drill, rollback rehearsal, incident roster, and alert routing.
8. Obtain explicit human approval. A green CI run must never trigger backend production deployment by itself.

## Reference evidence used for this foundation

On 2026-07-18, Context7 CLI resolved `/nodejs/node` (Node.js primary repository documentation) for `HTTP server SIGTERM graceful shutdown process signals production`. The returned primary references were Node's `process` and `http` documentation, which document signal listeners and `server.close()` behavior. This supports the shutdown and health expectations in the deployment runbook; it does not prove the service has been exercised under a production orchestrator.

Docker and PostgreSQL queries and their primary references are recorded in the deployment and backup/restore runbooks respectively.

On 2026-07-19, Context7 CLI resolved the primary Mozilla PDF.js repository as
`/mozilla/pdf.js` for byte-based `getDocument`, text extraction, cleanup, and
resource options. Exact registry metadata separately established
`pdfjs-dist@6.1.200`, Apache-2.0, and its supported Node engine range. The
implementation uses the locked release API but records that Context7's repository
documentation tracks a different revision; this evidence supports the design and
does not prove hostile-file sandboxing or production runtime safety.

Also on 2026-07-19, Context7 resolved `/brianc/node-postgres` for its primary
transaction guidance: all statements in one transaction must use the same
checked-out client, with explicit `BEGIN`/`COMMIT`/`ROLLBACK` and release. Current
PostgreSQL documentation was consulted for `ON CONFLICT`, row locking,
`SKIP LOCKED`, and forced RLS. This supports the transaction/claim design; it is
not a production topology, load, or role attestation.

## Review triggers

Re-run this threat model when an endpoint, tenant/role, data classification, ingestion path, model/provider, external adapter, storage service, deployment platform, or public origin changes; after a security incident; and before the first production approval.
