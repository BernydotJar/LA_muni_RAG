# Requirements traceability — Feature 072

| Requirement | Implementation | Verification |
|---|---|---|
| Dedicated browser route | public query handler/server routing | HTTP unit tests, production smoke |
| No browser tenant/credential | closed request schema; server config | negative tenant/Auth/Cookie tests |
| Exact Origin/CORS | handler origin allowlist | foreign/missing/preflight tests |
| Global/client abuse gate | HMAC rate repository/migration | unit, SQL and PostgreSQL smoke |
| Public-only evidence | reused SearchEvidence repository | tenant fixtures, RLS gate and smoke |
| No comparative promotion | response composer | comparative-only tests and smoke |
| Safe links and bounded fields | HTTPS/no-query projection, closed response | signed/HTTP URL negative tests |
| Minimized audit | allowlisted details and no raw columns | in-memory assertions and owner receipt inspection |
| Disabled by default | environment config factory | 503 test and docs |
| No production deployment claim | docs/program state | eval and release-state evidence |
