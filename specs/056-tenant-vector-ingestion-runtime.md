# Feature 056 — Tenant Vector and Durable Ingestion Runtime

## Goal

Provide a fail-closed PostgreSQL foundation for tenant-scoped embedding
persistence and durable document-vector ingestion jobs. The foundation must
prevent global-pool writes, cross-tenant key conflicts, stale-worker commits,
partial vector generations, and raw token/error persistence.

This feature does not expose an ingestion HTTP endpoint, start a worker, acquire
or scan a document, parse the controlled DMP, or authorize deployment.

## Dependencies

- migration `003_identity_tenancy_rbac.sql` and its transaction-local tenant
  context;
- immutable `rag.document_versions` artifact identity;
- bounded normalized-document and embedding preparation from Features 054–055;
- PostgreSQL 16 and pgvector 0.8 production-shape validation before release.

## Canonical migration path

A fresh database applies `001`, `002`, `003`, `004`, then `005`. Migration `005`
creates the operational `rag.embedding_vectors` table itself; the standalone
`migrations/011-production-vector-store.sql` is legacy-only and is not part of a
fresh install.

Existing deployments that applied `011` before `003` converge through `005`.
If `011` was applied after `003` and unscoped rows exist, `005` stops and requires
an explicit reviewed tenant mapping. It never assigns those rows to a guessed
bootstrap tenant.

## Durable job identity

Job type `document_vector_index_v1` binds:

- authenticated tenant and requesting principal;
- exact `document_version_id` and accepted raw-artifact SHA-256;
- exact extractor, chunk-planner, embedding provider/model/dimension config;
- bounded maximum attempts;
- a caller idempotency key stored only as SHA-256.

The request, artifact, pipeline, work, idempotency, worker, and lease identities
are persisted as fixed-length digests. Raw idempotency keys and raw lease tokens
must never be stored.

## Job lifecycle

1. `enqueue` verifies an active same-tenant document/version and exact artifact
   digest, then returns `new`, `replay`, `duplicate_work`, or `conflict`.
2. `leaseNext` claims one eligible row using `FOR UPDATE SKIP LOCKED`, a bounded
   lease, an incremented attempt counter, and a freshly generated fencing token.
3. The worker extracts/chunks/embeds outside the database transaction.
4. `heartbeat` extends only an unexpired lease whose token digest still matches.
5. `complete` locks the leased job and document version; rechecks artifact,
   canonical document identity, provider/model/dimension, and vector bounds; then
   replaces one complete vector generation, marks the version/job processed, and
   writes sanitized audit in one tenant transaction.
6. `fail` schedules bounded exponential retry or records a terminal stable error
   code. Raw exception text is not persisted.
7. An expired lease can be reclaimed with a new token. Every old token is fenced
   from heartbeat, completion, or failure mutation.

## Vector boundary

- primary identity is `(tenant_id, chunk_id)`;
- vectors have same-tenant foreign keys to document version and ingestion job;
- every v1 row is job- and document-version-bound;
- the RLS write policy and post-migration default reject creation of new
  contract-0 rows; historical contract-0 rows remain readable only within their
  tenant for explicit reconciliation and are never eligible for v1 search;
- insert/update/delete use the caller's transaction-bound client and repeat
  explicit tenant predicates in addition to forced RLS;
- completion validates the stored database title/version/key before writes;
- a successful replacement removes stale v1 chunks for that document version in
  the same transaction;
- vector writes are parameterized in batches of at most 64, and PostgreSQL—not
  the worker—sets `indexed_at`;
- public search admits only processed jobs and versions, active documents,
  `metadata.confidentiality = public`, non-empty citations, and the exact
  provider/model/dimension;
- search is capped at 100 results.

The v1 table deliberately has no global approximate vector index. Global IVFFlat
candidates can be filtered after RLS and return too few tenant rows. Retrieval is
exact until a tenant-partitioned strategy has measured recall, query-plan, load,
and isolation evidence.

## Transaction and runtime rules

- all database work uses `withTenantTransaction` and `set_config(..., true)`;
- a failed rollback destroys the pooled client instead of returning a poisoned
  session to the pool;
- embedding provider calls happen before the short finalization transaction;
- direct vector indexing requires an explicitly injected repository;
- runtime dependency discovery never constructs a global `pg` vector repository;
- vector health remains degraded with `tenant_vector_context_required` until a
  repository already closed over an authenticated tenant transaction is supplied.

## Verification evidence

The disposable local gate uses PostgreSQL 16.14 and pgvector 0.8.5. It applies
fresh and legacy-supported migration orders, uses a table-non-owner role with
`NOSUPERUSER` and `NOBYPASSRLS`, and proves missing/malformed context denial.
The compiled service smoke covers idempotent replay/conflict/work deduplication,
50 concurrent submissions, two concurrent claimers, heartbeat, artifact and stale
lease fencing, retry/terminal failure, cross-tenant identical chunk ids, atomic
rollback, successful replacement, stale-chunk deletion, and eligible public
search. All inputs are synthetic; controlled artifact reads remain zero.
Backend CI declares the same canonical migration, non-owner SQL, and compiled
service gates against the digest-pinned PostgreSQL/pgvector container image; the run must
still pass for the reviewed commit before it is release evidence.

## Residual production boundary

Still required before operational ingestion:

- authenticated tenant-scoped API/RBAC and a separately deployed worker;
- durable object storage, persisted scan evidence, real scanner service, and
  approved parser/container isolation;
- production runtime-role provisioning and startup/continuous role attestation;
- queue depth, per-tenant quotas, cancellation, operator repair, and monitoring;
- exact-search load/statement-timeout evidence and a reviewed partition/index
  design before corpus scale demands approximation;
- migration ledger, populated-data lock/duration test, backup/restore rehearsal,
  staging repetition, HA/failover exercise, and human release approval.

`rag.section_embeddings` and the old `PgVectorEmbeddingRepository` remain legacy
surfaces. The operational v1 chunk index is `rag.embedding_vectors`, and no
runtime default routes through the legacy writer.

## Acceptance criteria

- [x] Fresh and supported legacy migration chains converge.
- [x] Unsafe unscoped legacy rows stop migration for review.
- [x] Vector/job tables force tenant RLS and runtime code repeats tenant scope.
- [x] Idempotency and lease secrets are digest-only.
- [x] Job attempts, leases, heartbeats, retries, and errors are bounded.
- [x] Stale leases cannot mutate a job or vector generation.
- [x] Canonical artifact and document identities are rechecked at completion.
- [x] Vector replacement, job/version state, and audit are atomic.
- [x] Cross-tenant equal chunk ids coexist without visibility leakage.
- [x] Provider work is prepared outside the transaction with chunk/batch caps.
- [x] Global default vector writes and false-positive vector readiness are removed.
- [x] Real non-owner PostgreSQL SQL and compiled-service gates pass locally.
- [ ] Authenticated API, worker deployment, storage/scanner integration, load/HA,
  and production attestation are completed in later reviewed features.
