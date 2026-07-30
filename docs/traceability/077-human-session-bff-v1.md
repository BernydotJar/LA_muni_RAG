# Feature 077 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Human identity separate from integration credentials | `src/humanSession/*`; migration 017 tables; no changes to `identity.api_credentials` | migration test; service Bearer compatibility test |
| Provider-neutral boundary | `HumanIdentityProviderAdapter`, `SecretProtector`, repository interfaces | EVAL contract assertions; deterministic adapter smoke |
| State, browser binding, nonce, PKCE | `handler.ts`, `crypto.ts`, protected login transaction | malformed/binding/nonce tests; SQL consume-once gate |
| Code replay denial | `claimAuthorizationCode`; unique provider/code digest table | HTTP cross-transaction replay; SQL gate |
| Fixation prevention and rotation | login clears session; callback fresh token; bootstrap/explicit rotate | fixation test; old-token rejection; compiled smoke |
| Cookie policy | cookie builder and origin-derived `__Host-` names | local/HTTPS cookie tests |
| CSRF | exact Origin and session-bound `x-csrf-token` digest | missing/wrong/valid CSRF tests; compiled smoke |
| Expiry, revocation, logout | repository lifecycle and `/auth/logout` | expired/revoked tests; SQL and compiled smoke |
| Tenant membership and role mapping | `resolveHumanMembership`; `identity.human_subjects` joined to local memberships | ambiguous cross-tenant denial; injected provider role ignored |
| Audit minimization | closed audit interfaces/functions and failure buckets | in-memory leak scan; SQL audit inspection |
| Test adapter only | deterministic provider/protector production guards | configuration/EVAL tests |
| Fail closed without approved IdP | disabled default and strict enabled composition | 503 and constructor tests |
| PostgreSQL least privilege | forced RLS, fixed-search-path security-definer functions, revoked PUBLIC grants | `human_session_bff_runtime_gate.sql` |
| Existing service compatibility | unchanged `authenticateBearer` path | focused compatibility test and full regression |
| No false browser readiness claim | staging blocker retained; program metrics remain 0/12 | program/current-state and EVAL assertions |

## Named evaluation

`EVAL-HUMAN-SESSION-BFF-001` runs via `npm run eval:human-session-bff` and verifies the implementation, migration, documentation, provider-neutral/fail-closed boundaries, audit minimization, and explicit non-readiness claims. Focused executable lifecycle evidence runs via `npm run test:human-session-bff`; the compiled database boundary runs via `npm run smoke:human-session-bff` after migration/runtime-gate setup.
