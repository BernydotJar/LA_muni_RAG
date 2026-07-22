# Risk Register — Governed Workflow Lifecycle

| ID | Risk | Severity | Control in this slice | Residual condition |
|---|---|---:|---|---|
| WL-01 | AI output is presented as approved procedure | critical | All versions start `draft`; DB trigger rejects non-draft inserts | API/UI wording and production data migration still require review |
| WL-02 | Creator self-reviews or self-approves | high | State machine and DB triggers enforce distinct creator/reviewer/approver | Admin emergency process is intentionally absent and must not bypass controls |
| WL-03 | Approved content changes without a new version | critical | Approved/superseded/archived content is immutable | Direct owner/superuser access must remain restricted and monitored |
| WL-04 | Two versions are approved concurrently | high | Partial unique index permits one approved version per tenant/procedure | Transactional supersession/approval service and concurrency test still required |
| WL-05 | Cross-tenant workflow or review access | critical | Composite tenant FKs and forced RLS on all four tables | Non-owner PostgreSQL and HTTP negative tests pending for migration 009 |
| WL-06 | Review evidence is rewritten after a decision | high | Review and approval rows are append-only via triggers | Backup/operator access policy and audit monitoring pending |
| WL-07 | Supersession points to another procedure | high | Trigger verifies replacement belongs to the same tenant/procedure | Replacement approval and atomic transition service pending |
| WL-08 | Operational approval is confused with legal sufficiency | high | Docs and state model separate evidence status from approval state | UI labels, training, legal governance, and release review pending |
| WL-09 | Oversized or malicious workflow JSON exhausts resources | high | 2 MB serialized definition bound and JSON-object checks | API request limits, recursive schema complexity, and load tests pending |
| WL-10 | Migration cannot be applied or rolled forward safely | high | Additive migration, explicit checks, static tests | Disposable PostgreSQL/pgvector migration gate and restore drill pending |
