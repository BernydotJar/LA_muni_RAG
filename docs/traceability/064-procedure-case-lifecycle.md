# Traceability — Feature 064

| Requirement | Implementation | Verification |
|---|---|---|
| Approved workflow binding | migration 013 trigger; repository create | API test; SQL gate; HTTP smoke |
| Tenant/RBAC | handler, security permissions, forced RLS | negative API tests; SQL role gate |
| Exact replay/concurrency | canonical hash, advisory lock, sealed response | concurrent API test; compiled HTTP smoke |
| Case steps and revision | case step table and expected revision | API mutation test; SQL trigger gate |
| Document evidence identity | composite document-version FK | invalid document API/HTTP tests |
| Blockers and follow-up | bounded mutation union | API mutation test |
| Append-only audit | case event trigger and audit allowlist | SQL gate; API no-text-leak assertion |
| No legal-status promotion | closed response schema and limitations | EVAL-CASE-001; contract validation |
| Integration contract | two JSON Schemas, examples and OpenAPI paths | `npm run contracts:validate` |
