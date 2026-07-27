# Tasks

- [x] Reconstruct service Bearer, tenancy, RBAC, audit, staging, and browser blocker baseline.
- [x] Define provider-neutral human identity/session interfaces.
- [x] Implement state, browser binding, nonce, and PKCE S256 login initiation.
- [x] Implement atomic callback, authorization-code replay denial, local membership resolution, and fresh session issuance.
- [x] Implement HttpOnly/SameSite cookies, Secure `__Host-` cookies outside localhost, bounded expiry, rotation, revocation, and logout.
- [x] Implement same-origin CSRF for browser mutations.
- [x] Preserve service/integration Bearer compatibility while rejecting Bearer on browser routes.
- [x] Add test-only deterministic provider, protector, and in-memory repository with production guards.
- [x] Add migration 017, forced RLS, security-definer repository functions, and minimized audit/failure aggregation.
- [x] Add focused HTTP adversarial tests, migration tests, non-owner PostgreSQL gate, and compiled PostgreSQL smoke.
- [x] Complete named EVAL, full regression, independent review, database gates, structured validation, dependency audit, secret/PII scan, and diff checks.
- [ ] Reconcile program artifacts, publish the exact SHA, update PR #24, and observe exact-SHA CI.
- [ ] Implement authenticated role-aware product shell in a subsequent increment.
- [ ] Select/provision a productive IdP only after explicit human approval.
