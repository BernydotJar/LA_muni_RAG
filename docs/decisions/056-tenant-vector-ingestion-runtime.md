# Decision Log — Feature 056

## D-056-01 — Make migration 005 the canonical vector migration

Fresh installations create the tenant-owned vector table in migration `005`.
The standalone migration `011` is legacy-only.

Reason: the operational table must not depend on an order-sensitive unscoped
migration. Existing pre-003 installations still have an explicit upgrade path.

## D-056-02 — Stop rather than invent ownership

Migration `005` raises on NULL-tenant legacy vector rows.

Reason: assigning an unknown row to the bootstrap tenant would fabricate data
ownership and could expose another tenant's content.

## D-056-03 — Use a transaction-bound repository

`TenantPgVectorRepository` accepts an existing tenant transaction client; it
does not own or default a global pool.

Reason: the transaction-local RLS context and the vector/job/version/audit writes
must share one physical PostgreSQL connection and commit boundary.

## D-056-04 — Prepare embeddings before finalization

Chunk planning and provider calls finish before the short completion transaction.

Reason: remote model latency must not hold database row locks or leases inside a
transaction. Only bounded validation and persistence are atomic. Persistence uses
64-record parameterized batches and server timestamps to limit round trips and
prevent worker-controlled indexing time.

## D-056-05 — Persist only digests for replay and lease credentials

Idempotency keys, worker identities, and lease tokens are SHA-256 digests in
PostgreSQL. Raw lease tokens exist only in worker memory.

Reason: database/log exposure must not create reusable control credentials.

## D-056-06 — Fence every worker mutation

Heartbeat, completion, and failure require an unexpired current lease-token
digest. Reclaim creates a new token and increments the attempt.

Reason: a slow or partitioned worker must never commit after ownership changes.

## D-056-07 — Atomically replace a complete generation

Completion upserts every validated chunk, deletes stale v1 chunks for the same
document version, marks job/version processed, and audits in one transaction.

Reason: readers must not observe partial generations or success state without
matching vectors and provenance.

## D-056-08 — Recheck artifact and canonical document identity

Finalization compares the leased artifact digest with the locked document
version and requires every record to use the database key/title/version.

Reason: possession of a lease must not permit accidental source substitution or
spoofed retrieval labels.

## D-056-09 — Keep v1 search exact initially

Migration `005` removes the standalone table's global IVFFlat and global lookup
indexes. Tenant-leading B-tree indexes remain; cosine ordering is exact.

Reason: approximate global candidates can be filtered by RLS after selection and
return too few tenant results. A partitioned approximate design needs measured
recall and load evidence.

## D-056-10 — Fail health closed without tenant context

Runtime dependency discovery no longer treats database/provider configuration
as enough to enable vector retrieval. It needs an explicitly supplied
tenant-bound repository.

Reason: a global readiness claim encourages unsafe repository reuse and cannot
prove the authenticated request's tenant boundary.

## D-056-11 — Preserve legacy stores without routing new writes to them

`rag.section_embeddings` and `PgVectorEmbeddingRepository` remain for migration
history and tests, but new runtime defaults do not use them.

Reason: destructive removal needs separate compatibility review; dormant legacy
code is safer than silently adapting it around forced tenant constraints. The
v1 RLS write policy prevents creation of new contract-0 vector rows.
