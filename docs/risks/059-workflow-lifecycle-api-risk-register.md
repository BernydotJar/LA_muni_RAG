# Risk Register — Workflow Lifecycle API v1

| ID | Risk | Severity | Control | Residual condition |
|---|---|---:|---|---|
| WLAPI-01 | Body parsing or schema work occurs before authentication | critical | Handler authenticates and checks coarse permission before body listeners; adversarial malformed-body tests | Proxy/ingress slow-client and load behavior remains untested |
| WLAPI-02 | Caller or AI directly creates an approved workflow | critical | Draft schema const, nested boundary check, state machine, and insert trigger | Owner/superuser access and operational UI still require governance |
| WLAPI-03 | Creator self-reviews or self-approves | critical | Action RBAC plus state-machine and database separation triggers | Emergency override is intentionally absent |
| WLAPI-04 | Cross-tenant workflow metadata leaks through read or error behavior | critical | Transaction tenant context, forced RLS, explicit tenant predicates, uniform 404, leakage tests | Production role/topology attestation remains pending |
| WLAPI-05 | A concurrent request loses its idempotency claim | high | Release occurs only after this execution received a new claim; concurrent HTTP test | Distributed load and failover have not been measured |
| WLAPI-06 | Corrupt replay remains permanently stored or leaks attacker bytes | critical | Response revalidation; committed invalidation and bounded audit before generic 500; recovery smoke | Production corruption monitoring/repair tooling remains pending |
| WLAPI-07 | Request key or bearer token is persisted | high | SHA-256 idempotency key, credential digest auth, allowlisted audits, schema/static tests | Secret scanning and production log pipeline remain independent gates |
| WLAPI-08 | Approved content mutates without a new version | critical | Service transition rules and database immutable-content trigger | Superuser/operator access must be restricted and audited |
| WLAPI-09 | Replay response exceeds storage/resource limits | high | Request and response schema limits; 4 MiB DB bound; 2 MiB workflow definition bound | Load and recursive-complexity thresholds remain unproved |
| WLAPI-10 | Review/approval status is mistaken for legal validity | high | Response limitations, API docs, product-boundary docs | UX, training, legal governance, and consumer behavior remain pending |
| WLAPI-11 | Authentication-failure audit becomes an enumeration or secret store | high | Pre-tenant aggregate stores only UUID correlation, reason code, bucket/count; table revoked; SECURITY DEFINER function fixed | Production retention and monitoring remain pending |
| WLAPI-12 | OpenAPI drifts from runtime | high | Contract registry validates methods, headers, status sets, schemas, and examples in CI | Consumer contract tests in adjacent repositories remain pending |
