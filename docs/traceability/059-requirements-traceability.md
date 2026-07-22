# Requirements Traceability — Feature 059

| Requirement | Implementation evidence | Verification | Status |
|---|---|---|---|
| Four required lifecycle routes | `workflowLifecycleHandler.ts`; `server.ts` | HTTP/OpenAPI tests | PASS local |
| Auth before body | `authenticateBearer` precedes `readJsonBody` | malformed unauthenticated/forbidden body tests | PASS local |
| Action-specific RBAC | `permissionForOperation`; canonical permissions | author/reviewer/approver negative and positive cases | PASS local |
| Tenant and credential binding | `requireRequestIdentity`; nested draft check | outer/nested cross-tenant tests | PASS local |
| New versions start draft | draft schema, state machine, migration 009 trigger | schema/state/SQL negative tests | PASS local/static |
| Distinct human review/approval | state machine, repository, DB triggers | full lifecycle and self-action denial tests | PASS local/static |
| Exact replay | idempotency repository and response validator | byte-for-byte replay test | PASS local |
| Conflict and in-progress behavior | request digest and state machine | conflict/concurrent claim test | PASS local |
| Corrupt replay recovery | committed invalidation branch | static/unit tests and compiled PostgreSQL smoke | PASS PostgreSQL 15.18 / pgvector 0.8.5 |
| Bounded request/response | per-route JSON limit, workflow size validation, DB response bound | migration/HTTP tests | PASS local/static |
| Rate limiting | tenant/principal/operation repository | rate-before-mutation test | PASS local |
| Bounded audit | allowlisted lifecycle events and pre-tenant aggregate | audit assertions and migration tests | PASS local/static |
| Uniform non-enumerating read | tenant transaction plus `404 not_found` | missing/cross-tenant equality test | PASS local |
| Atomic supersession | combined state machine, repository transaction, replacement trigger and unique approved index | state-machine, HTTP, SQL, and compiled smoke | PASS local/PostgreSQL |
| Forced RLS/non-owner | migrations 009–010; SQL gate | `workflow_lifecycle_runtime_gate.sql` | PASS PostgreSQL 15.18 / pgvector 0.8.5 |
| Strict contracts | four schemas, examples, OpenAPI 3.1.1 | 16/16 registry and contract tests | PASS local |
| Compiled Postgres adapter | `PostgresWorkflowLifecycleRepository`; smoke script | `npm run smoke:workflow-lifecycle` | PASS local PostgreSQL runtime |
| No adjacent-product scope | schemas/tables exclude campaign/content state | boundary/static migration tests | PASS local |
| Documentation current | API doc, ADR, risk, spec, README, program state | link/diff review | PASS local pending final regression |
| Remote publication and CI | authorized feature branch push | remote ref and GitHub Actions | PENDING |
| Merge/deploy | prohibited without human approval | none | NOT ATTEMPTED |
