# Traceability — Feature 062 EvidenceGapRequest v1

| Requirement | Implementation | Verification |
|---|---|---|
| Auth before body | `evidenceGapHandler.ts` | EVAL auth malformed-body 401 |
| RBAC/tenant/credential binding | handler + shared security helpers | EVAL role/tenant tests; SQL/HTTP gate |
| Closed request/response contracts | request/response schemas + registry/OpenAPI | contracts validation 17/17; integration contract suite |
| Exact key replay | idempotency persistence + canonical replay validation | EVAL exact replay; compiled smoke |
| Aggregate replay/conflict | `createOrReplayGap` | EVAL second-key replay/conflict; compiled smoke |
| Rate limit before validation | handler rate gate + dedicated table | EVAL bounded rate audit |
| Immutable open aggregate | migration 012 table/trigger/privileges | migration test; non-owner SQL gate |
| Response digest integrity | PostgreSQL `digest` constraints + handler SHA-256 | SQL gate tamper rejection; replay tests |
| No source-authority promotion | schema, boundary checks, deterministic response | EVAL unknown fields/imperative authority; smoke |
| Audit minimization | allowlisted `EvidenceGapAuditRecord` persistence | leak regression |
| Pre-tenant auth aggregation | dedicated table/function | SQL gate aggregation and privilege denial |
| CI and release evidence | package scripts + backend workflow | local scripts pass; remote CI pending |
