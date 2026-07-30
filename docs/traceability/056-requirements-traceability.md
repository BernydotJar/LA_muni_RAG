# Requirements Traceability — Feature 056

| Requirement | Implementation | Verification |
|---|---|---|
| Canonical fresh vector migration | `db/migrations/005_tenant_ingestion_runtime.sql` creates/converges table | fresh `001..005` PostgreSQL gate |
| Support reviewed historical order | migration `005` upgrades `011 -> 003` table | legacy `001,002,011,003,004,005` run |
| Stop unsafe unscoped rows | explicit NULL-tenant exception; no ownership backfill | unsafe-order negative migration run and static test |
| Force tenant isolation | vector/job RLS plus composite tenant FKs/keys | non-owner SQL gate and catalog assertions |
| Preserve connection-local tenant boundary | `withTenantTransaction` uses local setting and destroys rollback-failed clients | identity/tenancy unit tests |
| Bind job to principal/version/artifact/pipeline | canonical digest builders and enqueue version/hash lookup | identity unit tests and compiled DB smoke |
| Store no raw idempotency or lease credentials | SHA-256 bytea columns and token generation in service | migration static assertions and DB inspection |
| Deduplicate replay/work safely | conditional unique indexes and enqueue resolution | replay/conflict/duplicate-work plus 50-way smoke |
| Claim one worker safely | `FOR UPDATE SKIP LOCKED`, bounded lease and attempt increment | two-claimer concurrency smoke |
| Fence stale workers | digest+expiry predicates on heartbeat/complete/fail | expiry/reclaim/old-token smoke |
| Bound retry behavior | attempt 1–10, exponential delay capped at 900 seconds | identity/failure unit and service smoke |
| Prepare provider work outside transaction | `prepareDocumentEmbeddings` separated from persistence | indexer unit tests and code boundary review |
| Bound provider expansion | planner stops at cap+1; 5,000 chunks and 64-text batches | chunk/indexer adversarial tests |
| Bind completion to accepted artifact | job exposes digest; complete input and locked version must match | artifact-fencing compiled smoke |
| Bind vectors to canonical source identity | repository requires database document key/title/version | repository mismatch unit test and compiled smoke |
| Replace a generation atomically | transaction-bound upsert/update/delete plus job/version/audit | stale deletion and injected rollback smoke |
| Bound finalization round trips and indexing time | 64-record vector batches and `statement_timestamp()` | 65-record batching/server-time unit test and real PostgreSQL upsert smoke |
| Prevent cross-document chunk takeover | conflict lock verifies same document version/contract | repository conflict unit test |
| Admit only eligible public vectors | processed job/version, active/public document, citation, provider/model/dimension joins | repository SQL unit test and real public-search smoke |
| Avoid tenant-filtered approximate recall loss | migration drops global standalone IVFFlat index | migration static/catalog verification |
| Remove global default vector writes | direct indexing requires injected repository | vector indexing tests |
| Fail vector readiness without tenant context | runtime context requires injected bound repository | runtime dependency tests |
| Keep errors/audit bounded and sanitized | allowlisted codes, aggregate metrics, bounded JSON | service static test and DB smoke |
| Do not touch controlled DMP | synthetic fixtures only | smoke reports `controlledArtifactsRead: 0`; inventory/worktree review |
| Document unresolved production gates | feature spec, runtime guide, threat/deployment/tenancy/runbook updates | link/governance review |
| Prevent database-control regression in CI | exact pgvector service plus canonical SQL and compiled smoke steps in `.github/workflows/ci.yml` | YAML parse, local equivalent gate, and GitHub check for reviewed commit |
