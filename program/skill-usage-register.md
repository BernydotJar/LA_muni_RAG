# Skill usage register

Last updated: 2026-07-21T06:46:34Z

Program source: attached `goal_la_muni_rag_procedural_intelligence_prod_ready.md` conversation artifact. No local macOS path is assumed.

Repository state observed during this session:

- workspace root: `/workspace`
- branch: `program/procedural-intelligence-prod-ready`
- origin/main baseline: `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`
- implementation HEAD at reconciliation: `ef86c14b07f5e8cb1528ba91a2e2c037aa4a4041`
- remote program branch: `6987f9d78f2d69a96b522ddfb920cd1ed1100437`
- divergence from remote program branch: 4 ahead / 0 behind before this control reconciliation; publication blocked by `BLK-CLOUD-PUSH-001`
- divergence from origin/main: 25 ahead / 0 behind
- local canonical gate: 550 passed / 552 total / 2 explicit skips / 0 failures; typecheck, build, contracts, inventory, dependency audit, and domain evaluation 8/8 passed
- source inventory: valid, 17 total documents, 4 verified, 4 missing_source, 1 acquired, and 0 ingested; acquisition is not ingestion
- repository instructions read from tracked `README.md` and `RTK.md`

## Skill-first decision log

| task_id | task | skill considered | decision | inputs | outputs | evidence | result |
|---|---|---|---|---|---|---|---|
| PRG-SKILL-001 | Bootstrap the program tooling controls | Current session skill catalog | No listed skill specifically covers AutoSkills, Context7/Farmtable availability auditing, or fallback program ledgers. Manual execution was selected. | Goal sections 12-16 and 20; RTK.md; package.json; current tool inventory | This register, Context7 evidence, task graph, task ledger | Initial API tool inventory search returned an empty array. Candidate skills such as skill-creator and plugin-creator target creation rather than this audit; repository-specific RICE skills target a different repository. Context7 was subsequently resolved through its CLI via npx. | completed |
| PRG-RTK-001 | Follow repository command-output guidance | Tracked repository instruction `RTK.md` | Used as repository guidance, not as an installed skill or assumed local executable. | RTK.md | Bounded repository inspection and command-output handling | `RTK.md` was read from `/workspace`; no macOS path or external RTK binary is required. | completed |
| PRG-AUTO-001 | Run the required AutoSkills dry-run without permitting a fetch or install | AutoSkills CLI 0.3.6 from the existing npm cache | Executed in offline dry-run mode. Installation was rejected pending license and review closure. | package.json; cached AutoSkills registry | Detected stack and six proposed skills listed below | npx --offline autoskills --dry-run exited 0 and ended with “--dry-run: nothing was installed.” | completed_with_limitations |
| PRG-CTX7-001 | Enable the Context7 evidence workflow | Context7 CLI via npx | CLI fallback activated without requiring a standalone executable. Ten libraries were resolved and queried; task-specific evidence remains mandatory. | Node v26.5.0 runtime; PostgreSQL/RLS/locking; node-postgres transactions; OpenAPI 3.1.1; JSON Schema object validation; Ajv validation; Docker; pgvector; ClamAV scanning; PDF.js | Versioned records and implementation decisions in program/context7-evidence.md | npx ctx7 v0.5.5, MIT, github.com/upstash/context7; current records include /brianc/node-postgres, /websites/postgresql_current, /docker/docs, /pgvector/pgvector, /cisco-talos/clamav, and /mozilla/pdf.js. | completed |
| PRG-FARM-001 | Initialize Farmtable or its semantic fallback | Farmtable CLI/MCP | Farmtable is unavailable. The required YAML graph and ledger are the active runtime of record. | Current API tool inventory and PATH; goal section 15 | program/task-graph.yaml and program/task-ledger.yaml | No Farmtable-related API tool was present; ft --version exited 127 with “zsh:1: command not found: ft”. | fallback_active |
| BOUND-001 | Establish canonical product boundaries and architecture | No listed repository-specific documentation skill applies to LA Muni RAG | Manual documentation-as-code workflow with explicit link verification. | Goal ownership, non-overlap, contracts, system context, data ownership | Nine canonical documents across docs/product, docs/architecture, and docs/integrations | Nine required documents exist; link audit checked 70 links with 0 broken. | completed |
| WS02-CORP-RECON-001 | Reconcile PDM-OT source truth without promoting lifecycle state | No listed corpus-reconciliation skill applies | Manual inventory, dry-run, portable identity, documentation, and focused-test workflow. | Existing PDM-OT official URL, version/date/hash metadata, optional local bytes, Feature 054 importer | Reconciled inventory and docs/data/source-inventory.md | missing_source to verified; no acquired/ingested claim; Feature 054 dry-run planned/mutated false; 15/15 focused tests and typecheck passed. | completed |
| WS02-DMP-ACQ-001 | Verify the official Antigua procedure-manual catalog and acquire the DMP v3 artifact | No listed corpus acquisition or malware-quarantine skill applies | Used authoritative-source research followed by the existing Feature 054 local import boundary; did not use a skill intended for unrelated repositories. | Official municipal catalog/API/PDF URL; metadata-only verification; bounded temp download; Feature 054 dry-run and import | Verified catalog, acquired DMP v3 record, portable bounded path, SHA-256 evidence, focused tests | Catalog missing_source to verified; DMP acquisition_pending to acquired; 49,052,885 bytes; SHA-256 4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9; repeat import noop; 15/15 focused tests and typecheck passed. | completed_with_limitations |
| WS03-ARTIFACT-SAFETY-001 | Add a fail-closed local artifact safety, malware, and quarantine gate | No listed skill targets this repository's Node CLI, local document library, or ClamAV boundary | Used the repository workflow plus Context7 Node/ClamAV evidence and official ClamAV primary documentation; no unrelated repository-specific skill was used. | Feature 054 importer; acquired-only DMP state; Node execFile boundary; ClamAV scanning/file-magic guidance | Structural/MIME/size gate, fixed scanner adapter, bounded evidence, no-replace quarantine/retry, ingestion enforcement, runbook, tests | Commit 37ff0ad; 43/43 focused and 479/479 global tests; typecheck/build/inventory/contracts/domain/link gates pass; real DMP dry-run remains noop with artifactSafety null and no mutation; real scanner absent. | completed_with_limitations |
| WS03-PDF-EXTRACTION-001 | Add bounded isolated raw-PDF extraction and parse-once indexing | No listed skill targets this repository's untrusted PDF parser, ingestion boundary, or Node process isolation design | Followed RTK.md and the repository workflow; used Context7 PDF.js evidence plus three goal-authorized read-only specialist agents for architecture, security, and dependency review. | Feature 054 safety boundary; raw PDF bytes; PDF.js 6.1.200; Node process permissions; parser and embedding abuse cases | Separate bounded worker, strict protocol/errors, private scanner snapshot, parse-once indexing, direct-route denial, chunk/batch caps, Feature 055 docs/tests | Commit 3a7b531; 80/80 focused and 498/498 global tests; typecheck/build/inventory/contracts/domain/Pages/link gates; audit 0; Docker build and non-root smoke; DMP untouched. | completed_with_limitations |
| WS03-TENANT-INGESTION-001 | Add tenant-scoped vector persistence and durable ingestion job controls | No listed skill targets this repository's PostgreSQL tenancy migration, job lease/fencing state machine, or pgvector persistence boundary | Followed RTK.md and the repository workflow; used Context7 node-postgres/PostgreSQL evidence plus the three goal-authorized vector database, tenant-security, and test-strategy specialist reviews. | Migrations 001-004 and legacy 011; pg 8.22.0; PostgreSQL 16.14/pgvector 0.8.5; current indexer/job gaps; controlled-DMP prohibition | Migration 005, non-owner RLS SQL gate, tenant repository, durable job service, compiled concurrency/fencing/rollback smoke, CI service, Feature 056 docs/tests | Commit 9dcc054; 517/517 tests across 91 suites; typecheck/build/inventory/contracts/domain/Pages/link/audit gates; fresh/legacy/unsafe migrations; SQL/service smokes; GitHub Actions run 29702647686 passed; DMP untouched. | completed_with_limitations |
| WS03-INGESTION-API-WORKER-001 | Add authenticated ingestion job APIs and a bounded accepted-artifact worker | No listed skill targets this repository's Node HTTP admission, PostgreSQL API-rate/audit migration, or immutable artifact worker boundary | Followed RTK.md and the repository workflow; used task-specific Context7 Node/PostgreSQL evidence, adversarial HTTP/worker tests, disposable database gates, and exact-commit CI. | Feature 056 durable jobs/vectors; identity/RBAC/RLS; strict v1 contracts; clean artifact evidence; controlled-DMP prohibition | Migration 006, strict enqueue/status API, forced-RLS admission, tenantless audit aggregate, immutable accepted-artifact worker, connection lifecycle hardening, compiled HTTP smoke, Feature 057 docs/tests | Commits 52ec72d and 50716cc; 545/545 tests across 95 suites; typecheck/build/inventory/11-contract/domain/Pages/link/audit/container gates; fresh/legacy/unsafe migrations; GitHub Actions runs 29707579030 and 29709823390 passed; DMP untouched. | completed_with_limitations |
| WS08-PROCEDURE-QUERY-001 | Implement and adversarially verify the procedure-query v1 provider | No listed skill targets this repository's Node/PostgreSQL API implementation | Used the repository contract/security foundations, Context7 evidence, direct code review, focused adversarial tests, and a guarded disposable PostgreSQL/HTTP gate. | Canonical v1 schemas/OpenAPI; identity/RBAC/RLS foundation; PostgreSQL 16.14/pgvector 0.8.5 disposable runtime | Secure provider, migration 004, public-only scoped retrieval, production legacy gate, DB fixture, HTTP smoke, current docs | Commit deef177; 35/35 focal tests; canonical Node summary 457/457 in a clean detached worktree; prior 539 reporter-marker count corrected; contract/inventory/domain/Pages/build/typecheck gates; 0 production dependency vulnerabilities; DB/HTTP statuses 200/200/409/403/400/401/500/200 and legacy 404. | completed_with_limitations |
| WS03-ARTIFACT-ACCEPTANCE-CI-001 | Align the ingestion runtime gate with persisted immutable-object and clean-scan acceptance | `skill-creator` was the only listed skill; it creates or updates skills and does not match repository implementation or database fixture repair | Manual repository workflow using the existing migration, RLS, worker, and smoke-test contracts; no unrelated skill was invoked | Migration 007; failed remote CI evidence; ingestion job service; tenant A/B SQL fixtures | Correct migration order, artifact-object/scan RLS checks, accepted fixtures, and completion binding | Commit a69fb15; integrated local regression at 1d129f0 passed 545/547 with 2 skips and 0 failures; live PostgreSQL rerun and remote CI remain blocked by sandbox runtime/publication limits | completed_with_limitations |
| WS05-WATER-001 | Compile and hard-evaluate the 47-category Antigua-first potable-water research workflow | `skill-creator` was the only listed skill; it does not implement domain compilers, contract mappers, or evaluation suites | Manual domain-model and test-first workflow using existing LA Muni RAG contracts; no new framework/API decision required a Context7 query | Golden water query; existing domain pack; ProcedureWorkflow v1 schema; product-boundary rules | Dedicated classifier/template, 47 research categories, canonical missing-evidence mapping, named hard eval, CI gate, documentation | Commit 1d129f0; EVAL-WATER-001 4/4; domain 7/7; focused 24/24; integrated 545/547 with 2 skips and 0 failures; synthetic/corpus/runtime limitations documented | completed_with_limitations |
| WS11-EVAL-PROCEDURE-001 | Hard-evaluate the literal generic procedure query and canonical workflow JSON | `skill-creator` was the only listed skill; it does not implement repository evaluation suites or domain classifiers | Manual test-first use of existing classifier, compiler, identity binding, mapper, and JSON Schema contracts | Literal X query; ProcedureWorkflow v1; controlled Antigua evidence identities; product-boundary rules | Retrieval-query deduplication, named hard eval, CI gate, domain case, documentation | Commit ef86c14; EVAL-PROCEDURE 4/4; domain 8/8; focused 25/25; integrated 550/552 with two skips and zero failures; synthetic/corpus/lifecycle limits documented | completed_with_limitations |
| PRG-CONTROL-RECON-20260721 | Reconcile program controls to current Git, tests, blockers, and product boundaries | No listed skill targets repository program-ledger reconciliation | Manual documentation-as-code update after validating Git state and parsing both YAML files | Local HEAD/upstream divergence; commits a69fb15 and 1d129f0; test evidence; Cloud Sandbox push failures | Updated task graph, ledger, skill register, claims, and external blocker record | Both YAML files parse successfully; macOS source-path assumption removed; production-ready claim remains unproven | completed |

## Context7 activation evidence

- invocation: npx ctx7
- CLI version: 0.5.5
- license: MIT
- repository: https://github.com/upstash/context7
- resolved libraries: /nodejs/node, /websites/postgresql_current, /brianc/node-postgres, /oai/openapi-specification/3.1.1, /websites/json-schema_understanding-json-schema, /ajv-validator/ajv/v8.17.1, /docker/docs, /pgvector/pgvector, /cisco-talos/clamav, /mozilla/pdf.js
- retrieved topics: timingSafeEqual/hash/randomUUID, HTTP IncomingMessage stream lifecycle, and execFile process bounds; PostgreSQL RLS default-deny/FORCE, SECURITY DEFINER search paths/privileges, ON CONFLICT, row locking and SKIP LOCKED; node-postgres transaction-bound clients; OpenAPI bearer security/components/JSON Schema; strict JSON Schema object validation; Ajv2020 strict/allErrors/addSchema; Docker multi-stage/non-root/health checks; pgvector versioned runtime setup; ClamAV scanning, limits, and file-type magic; PDF.js binary Uint8Array loading and page text extraction
- task result: BLK-CTX7-001 resolved and PRG-CTX7-001 completed
- limitation: Context7 Node documentation reaches v25 while the observed runtime is v26.5.0; v26-specific decisions require matching primary documentation
- Ajv implementation selection: ajv 8.20.0 and ajv-formats 3.0.1
- Ajv limitation: Context7 documentation is pinned to v8.17.1; compatibility with selected ajv 8.20.0 must be verified before passing the contract gate

## Completed program slices

### BOUND-001

Canonical documents:

1. docs/product/product-boundaries.md
2. docs/product/procedural-intelligence-vision.md
3. docs/architecture/bounded-contexts.md
4. docs/architecture/system-context.md
5. docs/architecture/data-ownership.md
6. docs/integrations/os-electoral.md
7. docs/integrations/content-agency.md
8. docs/integrations/contracts.md
9. docs/data/source-inventory.md

The canonical set contains 70 checked links and 0 broken links.

### WS02-CORP-RECON-001

- PDM-OT lifecycle transition: missing_source to verified
- deliberately unchanged lifecycle states: acquired false; ingested false
- portable identity: official URL, version, verification date, and SHA-256
- optional local-byte check: matching bytes verified without making the artifact a portable acquisition
- Feature 054 import check: dry-run with planned true and mutated false
- inventory summary: 16 total, 3 verified, 5 missing_source, 0 acquired, 0 ingested
- verification: 15/15 focused tests and typecheck passed
- parent workstream: WS02-CORP-001 remains in_progress and partial

### WS02-DMP-ACQ-001

- official Antigua procedure-manual catalog: missing_source to verified
- individual DMP v3 manual: acquisition_pending to acquired
- acquired bytes: 49,052,885; PDF 1.4; copied-byte SHA-256 `4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9`
- controlled path: repository-relative under the Git-ignored `.rag/library/` root
- repeated import: noop with mutated false
- current inventory: 17 total, 4 verified, 4 missing_source, 1 acquired, 0 ingested
- verification: 15/15 focused tests and typecheck passed
- limitations: no durable object store, real scanner runtime or clean DMP malware verdict, extraction, indexing, corpus-manifest reconciliation, validity approval, or reuse license; local safety/quarantine capability now exists at 37ff0ad
- parent workstream: WS02-CORP-001 remains in_progress and partial

### WS03-ARTIFACT-SAFETY-001

- commit: `37ff0ad`
- acquisition gate: bounded size, explicit MIME, extension, PDF/DOCX/text structural signatures, reread hash, and no-replace publication
- scanner boundary: fixed `clamdscan`/`clamscan`, `execFile` without shell, bounded timeout/output, stable clean/infected/error mapping
- enforcement: matching current safety evidence is mandatory before extraction; exact verified buffer is handed to vector indexing
- recovery: absent/error/infected/tampered artifacts fail closed; applied failures move by no-replace hard link to bounded quarantine and support a clean retry
- verification: 43/43 focused; 479/479 global; typecheck/build/inventory/contracts/domain passed; ten changed Markdown files had zero missing local links
- real DMP check: repeat import dry-run was noop, artifactSafety null, mutated false, zero sections/chunks; inventory and bytes were not changed
- limitations: no real ClamAV runtime/definitions/monitoring, no DMP verdict, no authenticated or durable library, no job/lock/audit layer, and no tenant-scoped vector write; bounded raw-PDF extraction is added later at `3a7b531`
- parent workstream: WS03-ING-001 is now in_progress and remains partial

### WS03-PDF-EXTRACTION-001

- commit: `3a7b531`
- skill decision: no listed repository skill covers LA Muni RAG PDF parsing/process isolation; RTK.md remained authoritative for command-output handling
- goal-authorized specialist review: read-only architecture, security, and dependency agents independently challenged the design; their findings drove the binary registry route, child-process boundary, scanner snapshot, parse-once path, and fixed work caps
- dependencies: exact direct `pdfjs-dist@6.1.200` (Apache-2.0) and `@napi-rs/canvas@1.0.2` (MIT); Node 24.12 production base satisfies PDF.js's published Node range
- extraction boundary: raw Buffer over stdin to a separate child with a private cwd/minimal environment, Node permissions, and hard application maxima for bytes, time, pages, page/total text, output, stderr, heap/stack settings, and per-process concurrency
- protocol and failure handling: strict v1 JSON; stable malformed/encrypted/no-text/timeout/crash/flood/protocol/capacity errors; sequential pages and bounded citations/hashes
- ingestion integrity: private verified scanner snapshot closes the tested A-to-B-to-A path mutation window; normalized document and exact verified bytes flow to the indexer without reread/reparse; direct raw-PDF indexing and backfill bypasses fail before provider work
- provider protection: maximum 5,000 chunks per document and 64 texts per embedding call, with sequential batches and fail-before-provider behavior
- verification: 80/80 focused and 498/498 global tests; typecheck/build/inventory/contracts/domain/Pages passed; 16 changed Markdown files, 11 local links, zero missing; production dependency audit reported zero vulnerabilities
- runtime verification: production-only Docker image built on `node:24.12.0-bookworm-slim`; the non-root runtime extracted a generated PDF through the copied worker
- controlled source state: DMP bytes and inventory were not scanned, extracted, indexed, promoted, removed, or mutated; it remains acquired only with `artifactSafety: null`
- limitations: the child is not a complete OS sandbox (no network namespace, seccomp, or hard total native-RSS proof); native canvas remains; concurrency is per process; OCR/table/form semantics are absent; no real scanner, authenticated/durable library, distributed jobs/locks/audit, tenant vector persistence, load gate, or deployment exists
- parent workstream: WS03-ING-001 remains in_progress and partial

### WS03-TENANT-INGESTION-001

- commit: `9dcc054`
- skill decision: no listed skill covers LA Muni RAG's PostgreSQL tenant migration, lease/fencing state machine, and pgvector persistence boundary; RTK.md remained authoritative for command-output handling
- goal-authorized specialist review: the vector database architecture, tenant-security, and test-strategy agents independently recommended a forward migration, transaction-bound tenant repository, embeddings outside transactions, digest work identity, leases/heartbeat/fencing, atomic vector/job/audit commits, and a real non-owner database gate
- transaction boundary: `pg@8.22.0`; each tenant operation holds one checked-out client from BEGIN through COMMIT/ROLLBACK and destroys the pooled client if rollback fails
- migration: canonical fresh order 001-005 and supported legacy order 001,002,011,003,004,005 pass; unscoped legacy vector rows stop migration 005 rather than receiving guessed ownership
- tenancy and vector persistence: FORCE RLS with tenant-composite identity, bounded contract-v1 rows, canonical job/document provenance, server timestamps, atomic replacement/rollback, and public-successful search filters
- jobs: digest-only idempotency and work identity; concurrent replay convergence; SKIP LOCKED claims; opaque leases, heartbeat, stale-token fencing, artifact recheck, bounded retry/exhaustion, terminal states, and allowlisted audit
- runtime hardening: provider work is prepared outside the transaction; documents cap at 5,000 chunks and embedding calls at 64 texts; the default global vector writer is removed and missing tenant/job context fails closed
- database verification: PostgreSQL 16.14/pgvector 0.8.5 fresh and legacy gates pass; the table-non-owner NOSUPERUSER/NOBYPASSRLS fixture denies cross-tenant, missing-context, and malformed-context reads/writes
- compiled smoke: 50 concurrent submissions converge to one job; two claimers yield one lease; stale lease and artifact identity are fenced; same chunk IDs coexist across tenants; failed finalization rolls back; successful replacement deletes stale rows; `controlledArtifactsRead` is 0
- regression: 517/517 tests across 91 suites; typecheck/build/inventory/contracts/domain/Pages/221-file relative-link checks pass; `npm audit --audit-level=high` reports zero vulnerabilities
- remote CI: Backend CI run `29702647686` passes commit `9dcc054` in 52 seconds, including the migration/RLS and compiled-service gates
- controlled source state: DMP bytes and inventory were not read by the database smokes, scanned, extracted, indexed, promoted, removed, or mutated; it remains acquired only with `artifactSafety: null`
- limitations: no authenticated API/worker dispatcher, real scanner, durable object storage, distributed quotas/deadline/dead-letter tooling, production monitoring/roles/HA/load/deployment, vector retrieval activation, or contract-0 validation exists
- parent workstream: WS03-ING-001 remains in_progress and partial

### WS03-INGESTION-API-WORKER-001

- commits: `52ec72d` feature foundation and `50716cc` early-rejection request-stream hardening
- skill decision: no listed skill covers LA Muni RAG's Node HTTP admission, PostgreSQL rate/audit migration, and immutable accepted-artifact worker boundary; RTK.md remained authoritative for command-output handling
- Context7 evidence: Node IncomingMessage/readable-stream and socket-close semantics plus PostgreSQL SECURITY DEFINER/search-path/privilege guidance are recorded under the task ID
- API boundary: strict `POST /api/v1/ingestion-jobs` and tenant-scoped `GET /api/v1/ingestion-jobs/{job_id}` with Bearer authentication, `document:ingest`, tenant match, server-owned pipeline, exact CORS, per-operation admission, replay/dedup/conflict, and uniform 404
- request lifecycle: authentication/admission precede body parsing; admitted JSON is capped at 16 KiB; early framed-body rejections return bounded errors with keep-alive disabled and `Connection: close`; framed GET bodies are rejected
- database boundary: migration 006 adds forced-RLS tenant/principal/operation counters and a fully revoked, fixed-search-path pre-tenant failure aggregate; no raw credential, request body, artifact, idempotency, worker, or lease material is stored
- worker boundary: no default storage/URL/path; injected immutable object generation and exact clean-scan evidence are validated against private bounded bytes, structural type, digest, and freshness before parsing and rehashed after parsing
- durable execution: provider work remains outside the final transaction; heartbeat checkpoints and Feature 056 lease fencing protect atomic vector/version/job/audit completion and stable retry/failure
- verification: 545/545 tests across 95 suites; typecheck/build/inventory/11 schemas and examples/6 domain cases/Pages/227 Markdown files/audit gates pass; exact final production image builds and loads all ingestion validators
- database verification: PostgreSQL 16.14/pgvector 0.8.5 fresh and supported-legacy paths pass; unsafe unscoped legacy state stops without guessed ownership; compiled HTTP statuses are 401/403/403/202/200/202/409/429/200/404/404
- remote CI: Backend CI runs `29707579030` and `29709823390` pass commits `52ec72d` and `50716cc`, including migration/RLS, compiled tenant-service, and compiled ingestion-API smokes
- controlled source state: DMP bytes and lifecycle state were not read, scanned, extracted, indexed, promoted, removed, or mutated; inventory remains 17 total / 4 verified / 4 missing / 8 acquisition_pending / 1 acquired / 0 ingested
- limitations: no source/version/upload administration, real scanner, durable object-store adapter, running/deployed worker, distributed quotas/cancellation, dead-letter/repair tools, observability, production roles/topology, load/HA, or deployment
- parent workstream: WS03-ING-001 remains in_progress and partial

### WS08-PROCEDURE-QUERY-001

- provider: `POST /api/v1/procedure-queries`, `requested_output=procedure_workflow` only
- commit: `deef177`
- controls: Bearer digest auth, `integration:query`, tenant/credential match, strict Ajv, body/rate limits, exact CORS, idempotency, bounded audit, public/active/processed retrieval, draft mapping, boundary refusal
- negative evidence: cross-tenant 403, exact replay/conflict, corrupt replay invalidation/retry, no raw token/key/question in audit details, non-CORS legacy 404 in production
- database gate: PostgreSQL 16.14, pgvector 0.8.5, non-owner/non-`BYPASSRLS` role, full migration order
- verification: 35/35 focused; canonical Node summary 457/457 at `deef177` in a clean detached worktree; contracts/inventory/domain/build/typecheck/Pages passed; `npm audit --omit=dev` found 0 vulnerabilities
- count correction: the prior 539 figure counted reporter markers and was not the Node test summary
- limitations: no OS Electoral consumer, EvidenceBundle/Assessment provider, lifecycle/approval store, staging/load test, production role/platform, or deployment

### WS03-ARTIFACT-ACCEPTANCE-CI-001

- commit: `a69fb15`
- scope: CI migration order, accepted immutable-object and clean-scan fixtures, artifact-table FORCE RLS assertions, tenant visibility checks, and worker completion binding
- local evidence: static migration/operations tests, typecheck, contracts, inventory, audit, domain evaluation, global tests, and build pass; the later integrated regression reports 545/547 with two explicit skips and zero failures
- limitations: this nested sandbox cannot start the PostgreSQL/pgvector service required for a live rerun, and the dedicated Cloud Sandbox push operation cannot publish the commit for remote CI
- boundary: no source/upload feature, scanner, object store, deployed worker, OS Electoral capability, or Content Agency capability was added

### WS11-EVAL-PROCEDURE-001

- commit: `ef86c14`
- input: `¿Cuál es el procedimiento para realizar X?`
- conservative classification: procedural `true`, workflow type `unknown`; `X` is not invented
- no-evidence output: three research steps, two dependencies, required/output documents, blocking gaps, and canonical missing evidence
- controlled evidence output: three identity-bound official Antigua sources and section citations, exactly one citation per matching step
- verification: EVAL-PROCEDURE-001 4/4; domain evaluation 8/8; focused tests 25/25; contracts/inventory/audit/typecheck/build pass; integrated regression 550/552 with two explicit skips and zero failures
- limitations: synthetic evidence only; no real corpus threshold, conflict review, persistent lifecycle, approval, or procedure-case proof
- boundary: evidence and procedure output only; no electoral strategy or content production

### WS05-WATER-001

- commit: `1d129f0`
- classification: `potable_water_project`
- output: exactly 47 ordered research categories and 46 research dependencies
- evidence policy: categories are not facts; unsupported operational fields remain null or empty; missing evidence uses `Documento o regla pendiente de localizar y validar.`
- selectivity control: one synthetic PDM-OT citation supports only the PDM-OT category and leaves the other 46 insufficient
- verification: EVAL-WATER-001 4/4; domain evaluation 7/7; focused tests 24/24; contracts 11 schemas and examples plus OpenAPI 3.1.1; integrated regression 545/547 with two explicit skips and zero failures; typecheck/build/audit/inventory pass
- limitations: no complete ingested Antigua corpus, official ordering, retrieval threshold, contradiction review, persistent lifecycle, human approval, or procedure-case instance is claimed
- boundary: the workflow returns evidence and procedure structure only; it does not design electoral strategy or generate/distribute content

### WS08-OS-PROVIDER-HARDENING-001

- skill: none matched from the installed skill directory; repository execution followed `RTK.md`
- task: independently critique and harden the OS Electoral EvidenceBundle provider
- inputs: commit `9c9803b`, canonical v1 schemas, procedure-query handler/mapper, EVAL-OS-INTEGRATION-001
- outputs: monotonic evidence-use mapping, explicit unsupported-step gaps, five-case OS integration eval, synchronized program evidence
- evidence: contracts 11/11, domain eval 8/8, EVAL-OS-INTEGRATION-001 5/5, integrated suite 574/576 with two explicit skips, typecheck/build/Pages/audit passed
- result: passed locally with remote PostgreSQL/HTTP smoke and consumer interoperability still pending


### WS08-CLAIM-PACK-001

- skill: none matched from the installed skill directory; repository execution followed `RTK.md`
- task: implement and independently harden a dedicated Content Agency ClaimPack provider without adding Content Agency production capabilities
- inputs: ClaimPack schema, product-boundary ADR/docs, identity/RBAC/RLS foundation, evidence identity mapper, Content Agency integration contract
- producer evidence: concurrent producer patches were captured under `/tmp` and reviewed; procedure-query request/handler residues were excluded in favor of a dedicated route and request schema
- outputs: `POST /api/v1/claim-packs`, strict request schema/example/OpenAPI, migration 008, RLS/idempotency/rate/audit persistence, compiled smoke, SQL gate, API/security/privacy docs, and `EVAL-CONTENT-INTEGRATION-001`
- critic/fixer findings: caller-owned legal disclaimer removed; valid_until changed from same-instant to bounded server-owned expiry; inference/validation-required claims fail closed; uniform 403 preserved; workflow limitations and contradiction caveat retained; expired/corrupt replay invalidated
- verification: commit `e8ac74f`; ClaimPack eval 7/7; contracts 12/12; contract tests 14/14; integrated suite 588/590 with two explicit skips and zero failures; all eight implemented named eval gates, typecheck, build, Pages verification, and npm audit passed
- result: provider passed locally with remote PostgreSQL/HTTP gate, external Content Agency consumer, cross-product revocation, staging/load, and deployment still pending

## AutoSkills dry-run evidence

The exact goal command was constrained to offline mode so npx could not fetch or install a package:

    npx --offline autoskills --dry-run

Observed result:

- exit code: 0
- AutoSkills version: 0.3.6
- detected technologies: TypeScript and Node.js
- reported target agents: universal and kiro-cli
- reported action: six skills proposed
- repository writes: none observed
- skills-lock.json: absent
- standalone autoskills executable on PATH: absent
- package source: existing npm npx cache inspected within the active workspace runtime; no macOS path is required or assumed
- cached package license: CC-BY-NC-4.0
- cached package package.json SHA-256: 43b3ef91d99553ed3a83e7f7af87c646a8006709ca966952db003a7fe1386781
- cached registry SHA-256: 12b50d1562e4b84a9e3ae051c0cd64532ff15c3f14202d32ec38a66d440103b0
- cached registry generatedAt: 2026-05-03T15:50:34.696Z
- cached registry reviewer metadata: model gpt-5.4, promptVersion 1.0.0

### Proposed skill manifest

| skill | source and path | pinned commit | bundle SHA-256 | files | registry review evidence |
|---|---|---|---|---|---|
| typescript-advanced-types | wshobson/agents/typescript-advanced-types | 87b81e9d642d7bb9602b33d1e2dadf1c2a619f2b | 5ca0e177c6aaaba1889255691224daafdb7d71f317cc70bede1590d3907ded42 | SKILL.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| nodejs-backend-patterns | wshobson/agents/nodejs-backend-patterns | 87b81e9d642d7bb9602b33d1e2dadf1c2a619f2b | 710a5e6f83c46e8f6c43356df55c143a7375c4414559a581654ce51709138c55 | SKILL.md; references/advanced-patterns.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| nodejs-best-practices | sickn33/antigravity-awesome-skills/nodejs-best-practices | 1930a079452fa15a54b6b4232a89d8a3f75c3239 | 7361ab02fb6b09913e3bdd9cf61c629ed6c17de9485e6a781054e5d437ccfc29 | SKILL.md | review approved and securityCheck status ok with no findings |
| frontend-design | anthropics/skills/frontend-design | 2c7ec5e78b8e5d43ea02e90bb8826f6b9f147b0c | 82fb11a63fb1e35ee2469516ed02d54695f783115b1540c0e783197af4240a3a | LICENSE.txt; SKILL.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| accessibility | addyosmani/web-quality-skills/accessibility | fed9617111260e19f4f54b72a2874a3f3de8ff94 | bffe3d08cfe92ebad63699f74ce29e35c19850ebfbf474c1463183cfe34d6a09 | SKILL.md; references/A11Y-PATTERNS.md; references/WCAG.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |
| seo | addyosmani/web-quality-skills/seo | fed9617111260e19f4f54b72a2874a3f3de8ff94 | c184da724d1c61ad077f27418ea8e7e88fd54bcdf98165e18be7e4681cbd5e20 | SKILL.md | status approved, but summary says “review skipped (--no-review)”; prompt-injection review is not proven |

### Installation decision

No skill was installed and no skills-lock.json was created.

Reasons:

1. The registry does not declare the license of each proposed skill. A bundled LICENSE.txt hash for frontend-design is not a license determination.
2. Five proposals have internally inconsistent review evidence: status approved while the review summary says review skipped.
3. Commit and content hashes reduce ambiguity but do not prove publisher identity, artifact provenance, or freedom from supply-chain compromise.
4. The AutoSkills package itself is CC-BY-NC-4.0. Its permissibility as development tooling and any distribution implications need explicit legal review for a commercial product.
5. The proposed target set includes universal and kiro-cli; the intended repository-local installation paths and agent scope were not printed by the dry-run.

Before any installation, require an owner to verify every skill file, license, destination path, publisher provenance, and hash against the pinned manifest. If approved, run the non-dry command separately, review the diff, and only then register skills-lock.json.

## Audit limitations

- npm view --offline autoskills@0.3.6 dist --json returned ENOTCACHED, so registry-provided tarball integrity and shasum were not independently recovered.
- npm cache verify returned EPERM while attempting to inspect a root-owned cache entry. No privilege escalation or ownership change was attempted, so whole-cache integrity remains unverified.
- This audit did not download source repositories, execute proposed skill content, or infer licenses from repository names.
- RTK.md was already untracked before the audit and was read only.
- Context7 availability is resolved through npx, not through a standalone PATH executable or MCP operation.

### WS03-ARTIFACT-VECTOR-HARDENING-001

- skill selection: no installed skill matched repository-level TypeScript/PostgreSQL implementation more specifically than direct repository execution; no skill was invoked or installed
- AutoSkills: `npx --offline autoskills --dry-run` exited 0 with AutoSkills 0.3.6, detected TypeScript/Node.js, proposed six skills, and wrote no files; installation remained rejected under the existing license/provenance review
- documentation tooling: Context7 `/websites/postgresql_current` queried for PL/pgSQL `BEFORE` row triggers, `RAISE EXCEPTION`, and transaction behavior at `2026-07-21T17:17:21Z`
- task: close the exact persisted artifact acceptance, job-lease, and vector-publication boundary without granting the worker artifact-table mutation privileges
- inputs: migrations 005–007, artifact acceptance repository/service, durable job service, tenant pgvector repository, non-owner SQL gate, compiled ingestion smokes, and Feature 060 spec
- outputs: migration 011, clean/legacy/corrupt-history PostgreSQL gates, security-definer row-lock function, repeated acceptance predicates, three named eval families, CI wiring, ADR/risk/traceability, and runtime documentation
- producer evidence: wrong-hash `clean` scan and 30-day acceptance were reproduced against PostgreSQL 15.18 before the fix
- critic/fixer evidence: direct `FOR SHARE` failed under the intended read-only artifact privilege; replaced with a tenant-bound fixed-search-path boolean security-definer function revoked from `PUBLIC`; accepted coordinate mutation was also closed
- verification: clean and supported legacy migration paths passed PostgreSQL 15.18/pgvector 0.8.5; corrupt historical state stopped and rolled back; non-owner SQL gates and compiled ingestion/API smokes passed; EVAL-ARTIFACT-001 5/5, EVAL-VECTOR-001 9/9, EVAL-JOB-LEASE-001 13/13; global suite 646/648 with zero failures and two explicit environment skips
- result: implemented and verified locally; remote CI, production scanner/storage/dispatcher, real-corpus vector quality/load, protected merge, and deployment remain pending
- product boundary: no electoral strategy, campaign operation, content production, publication, or neighboring-product source of truth was added


### WS08-PROCEDURE-ASSESSMENT-001

- skill selection: no installed session skill matched repository-level TypeScript/OpenAPI/PostgreSQL provider implementation more specifically than direct repository execution; no skill was installed or invoked
- AutoSkills: no second installation attempt; the session-level 0.3.6 dry-run remained unchanged and untrusted proposals stayed uninstalled under the existing license/provenance gate
- documentation tooling: Context7 `/oai/openapi-specification/3.1.1` queried for `oneOf`, external schema references, and constant response variants at `2026-07-21T17:48:55Z`
- task: implement a conservative `ProcedureAssessment` as the third `POST /api/v1/procedure-queries` output
- inputs: existing ProcedureAssessment schema/example, ProcedureQuery auth/idempotency/audit provider, canonical workflow mapper, OS integration tests, OpenAPI, non-owner PostgreSQL gate and compiled smoke
- outputs: draft-bound assessment mapper, runtime/replay validator, OpenAPI three-variant response, named eval, compiled smoke, ADR/risk/traceability and current integration docs
- producer evidence: assessment success/replay and schema validation; caller-owned opaque document IDs never enter completed requirements
- critic/fixer evidence: requirement-existence citations remain `inferred_for_review`; corrupt assessment replay is invalidated without marker leakage; old 503 contract/docs removed
- verification: EVAL-PROCEDURE-ASSESSMENT-001 4/4; EVAL-OS-INTEGRATION-001 5/5; procedure-query API, contract and operations suites 50/50; contract registry 16/16; global 652/654 with zero failures and two explicit environment skips; PostgreSQL 15.18/pgvector 0.8.5 non-owner gates and compiled ProcedureQuery, ClaimPack and lifecycle smokes pass
- result: implemented, verified in a detached checkout and PostgreSQL, published at exact SHA 56b9866, and Backend CI run 29855067232 passed; case/document binding, OS consumer, PR, merge and deployment remain pending
- product boundary: no campaign strategy, campaign mutation, content generation, publication, case completion, legal compliance or institutional approval was added

### WS08-EVIDENCE-GAP-001

- skill selection: no installed session skill matched repository-level
  TypeScript/OpenAPI/PostgreSQL provider implementation more specifically than
  direct repository execution; no skill was installed or invoked
- AutoSkills: no new installation attempt; the previously reviewed AutoSkills
  0.3.6 proposals remain uninstalled because license/provenance and review
  evidence are insufficient for this commercial product
- task: implement immutable EvidenceGapRequest intake with dual replay/aggregate
  identity, forced RLS, anti-authority controls and exact canonical replay
- producer evidence: closed schemas, dedicated handler/persistence, migration 012,
  named eval, OpenAPI and compiled smoke
- critic/fixer evidence: repaired nonexistent credential FK, priority mismatch,
  nonexistent schema definition, ClaimPack scaffold contamination, semantic replay
  tampering, authority laundering and concurrent-key convergence
- independent verification: detached real lockfile install; 14/14 focused gate;
  667/669 global; 17/17 registry; clean PostgreSQL 15.18/pgvector 0.8.5
  non-owner sequence; four compiled provider smokes; Backend CI 29861888791 passed
- result: implemented, verified, published and remote-CI green; external consumer,
  privacy retention/legal hold, research resolution, PR, merge and deployment remain open
- product boundary: no retrieval resolution, legal applicability, electoral
  strategy, content generation, publication or fake source-authority claim was added

### WS09-PROCEDURE-TRAINING-001 — selection checkpoint

- requested product direction: a beautiful training workflow for municipal
  procedures plus eventual SaaS delivery
- current frontend finding: public/demo static surfaces and browser-local case
  state exist; no human-browser authentication/session/BFF exists
- security decision: do not place integration Bearer credentials in browser code,
  LocalStorage or public Pages; any immediate training surface must remain clearly
  read-only/demo until the identity/session architecture is approved
- external design skills: not installed; prior supply-chain/license review remains
  unresolved, so the next UI slice will use repository-native HTML/CSS/JS and
  existing design tokens with direct accessibility tests

## 2026-07-21 — Features 064–066 and readiness reconciliation

- Matching installed skill: none. Available document/spreadsheet/slide/PDF and
  skill-authoring skills do not apply to TypeScript/PostgreSQL repository work.
- Execution tool: Cloud Sandbox MCP only.
- New external skill/package installation: none.
- Supply-chain changes: none; existing lockfile reused with `npm ci --ignore-scripts --prefer-offline`.
- Validation: `npm audit --audit-level=high` reported zero vulnerabilities.

### WS08-CATALOG-API-001

- skill selection: no installed skill matched repository-level TypeScript,
  OpenAPI and PostgreSQL catalog implementation; direct repository execution was used;
- task: implement source/document/job/procedure catalog routes without allowing
  authority, artifact, ingestion or retrieval-state promotion;
- outputs: migration 014, six route operations, eight schemas/examples, OpenAPI,
  non-owner SQL gate, compiled smoke, two named evals and documentation;
- critic/fixer findings: canonical replay reconstruction, committed corruption
  cleanup, signed-URL rejection, explicit SQL projections, server-owned document
  authority binding, rate-limit audit collision and a transitive dependency advisory;
- verification: detached 747/749 with zero failures, 27/27 contracts, fresh
  PostgreSQL 15.18/pgvector 0.8.5 migrations 001-014, compiled HTTP smoke and
  zero-vulnerability all/production audits;
- result: implemented, verified and published at exact SHA `9da2972`; remote CI,
  Search/EvidenceBundle, corpus ingestion, human SaaS, merge and deployment remain open.

## 2026-07-22 — Feature 072 public query gateway v1

- Matching installed skill: none. Repository-level TypeScript, OpenAPI, PostgreSQL, RLS and HTTP implementation was executed directly through Cloud Sandbox MCP.
- New external skill/package installation: none; the existing lockfile was retained.
- Producer scope: closed public schemas/OpenAPI, disabled-by-default handler, server-bound tenant/jurisdiction, HMAC/global rate persistence, minimized audit, forced-RLS retrieval and widget-compatible response.
- Critic/fixer scope: rejected Authorization/Cookie, moved rate gate before browser-credential rejection, required HTTPS citations without query/fragment, removed fictitious internal credential identity, added `nosniff` and exact CORS exposure, and proved cleanup/ownership/column restrictions.
- Independent verification: detached 23/23 eval, 840/842 global, 33/33 contracts, PostgreSQL 16.14/pgvector 0.8.5 migrations 001–016, non-owner forced-RLS gate, compiled smoke, zero dependency vulnerabilities and Backend CI 29955124279 success.
- Product boundary: gateway remains disabled and undeployed; no real corpus, edge protection, GCP resource, Pages binding, PR, merge or production observation is claimed.
