# Risk Register — Feature 056

| ID | Risk | Control | Residual state |
|---|---|---|---|
| R56-01 | Two tenants use the same chunk/idempotency/source identity | tenant-leading keys, unique indexes, explicit predicates, forced RLS | Controlled locally; repeat under approved production role/topology |
| R56-02 | Missing/malformed/session-leaked tenant context exposes rows | transaction-local setting, default-deny helper, rollback, poisoned-client destruction | Disposable non-owner gate passes; startup/continuous production attestation absent |
| R56-03 | Concurrent submissions create duplicate jobs | digest-bound unique idempotency/work indexes and conflict resolution | 50-way local test passes; distributed load/timeouts remain unmeasured |
| R56-04 | Stale worker commits after lease reclaim | digest-only fencing token plus expiry on every mutation | Controlled in local reclaim test; clock/HA/failover behavior untested |
| R56-05 | Provider call holds locks or leaves partial vectors | prepare outside transaction; atomic replacement/finalization | Controlled by code and rollback test; transaction duration/load thresholds pending |
| R56-06 | Worker finalizes another artifact or spoofed document label | artifact digest and locked canonical key/title/version recheck | Controlled locally; trusted worker/storage handoff is not yet implemented |
| R56-07 | Reindex leaves obsolete chunks | successful generation deletes prior v1 job rows in same transaction | Controlled locally; legacy contract-0 rows remain excluded and need migration policy |
| R56-08 | Approximate global index loses tenant recall | migration removes global IVFFlat; exact search | Correctness controlled; scale, statement timeout, and partition strategy open |
| R56-09 | Exact scan becomes denial-of-service at corpus scale | 100-result cap and tenant/model filters | Open until load limits, query plans, quotas, and monitoring are approved |
| R56-10 | Raw idempotency/lease/error values leak from persistence | digest-only fields and stable bounded error/audit codes | Application logs and centralized sink still require redaction verification |
| R56-11 | Runtime role bypasses RLS or owns tables | non-owner/NOSUPERUSER/NOBYPASSRLS integration fixture | Production provisioning and continuous role drift detection absent |
| R56-12 | Direct legacy writer bypasses job/provenance atomicity | default writer removed; direct vector indexing fails closed without injected repository | Exported legacy class remains dormant; future imports require review |
| R56-13 | Vector rows are retrieved before successful document/job state | joins require processed job/version, active/public document, citation and exact model | Controlled locally; procedure-query vector authorization/evals not wired |
| R56-14 | Retry storm exhausts provider/database | max attempts 10, exponential delay cap 900 seconds, SKIP LOCKED | Queue depth, per-tenant quotas, dead-letter/operator tools and monitoring absent |
| R56-15 | Migration blocks or misclassifies populated legacy data | explicit stop on unscoped rows and supported legacy-order test | Production-like restore, lock duration, reviewed ownership map and migration ledger absent |
| R56-16 | SQL constraint is mistaken for full legacy cleanup | runtime shape is `NOT VALID`, enforcing new/changed rows only | Legacy contract-0 inventory/validation remains a deliberate later migration |
| R56-17 | Job tables are mistaken for a safe DMP ingestion path | docs keep API/worker/scanner/storage gates explicit; smoke uses synthetic fixtures | DMP remains acquired only and untouched |
