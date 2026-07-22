# Requirements Traceability — Feature 058

| Requirement | Implementation evidence | Verification | Status |
|---|---|---|---|
| AI workflow starts draft | `initializeWorkflowVersion`; migration insert trigger | state-machine and migration tests | PASS local |
| Lifecycle vocabulary | TypeScript union; DB check | focused tests | PASS local |
| Draft-only content mutation | `reviseWorkflowDraft`; DB immutability trigger | negative tests | PASS local |
| Human review | `recordWorkflowReview`; `workflow_reviews` | recommended/changes-requested tests | PASS local |
| Human approval | `approveWorkflowVersion`; `workflow_approvals` | review-required tests | PASS local |
| Separation of duties | role/identity checks in state machine and DB triggers | creator/reviewer/approver negative cases | PASS local |
| Versioning | procedure/version number uniqueness | migration test | PASS static |
| One approved version | partial unique index | migration test | PASS static |
| Supersession | same-procedure replacement guard | state-machine/migration tests | PASS local/static |
| Archival | terminal state guard | state-machine/migration tests | PASS local/static |
| Tenant isolation | composite FKs, forced RLS policies | migration shape test | PASS static; runtime pending |
| Append-only governance | update/delete guard triggers | migration test | PASS static |
| Size/input safety | 2 MB bound, normalized text, UUID/time checks | adversarial unit tests | PASS local |
| No OS Electoral/Content Agency scope | data model excludes campaign/content fields | migration boundary test | PASS static |
| Authenticated APIs | not implemented in this foundation | none | PENDING |
| PostgreSQL non-owner runtime | migration 009 not executed in disposable DB on current HEAD | none | PENDING |
| Audit event persistence | lifecycle rows provide governance evidence; bounded `audit.events` hooks not implemented | none | PENDING |
