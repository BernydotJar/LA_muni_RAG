# Feature 077 — Provider-neutral human session/BFF foundation v1

Status: implemented locally; later Features 078 and 083 add the shell and generic OIDC adapter, while productive IdP approval remains absent

## Goal

Provide a provider-neutral human authentication boundary that is demonstrable locally without selecting or provisioning a productive identity provider. Human browser sessions must remain distinct from service/integration Bearer credentials, derive tenant roles only from local governed memberships, and fail closed whenever the approved provider boundary is absent.

## Functional requirements

1. Human subjects, login transactions, authorization-code replay state, and browser sessions are separate from `identity.api_credentials`.
2. Browser routes never accept Bearer credentials.
3. Login uses state, nonce, PKCE S256, and a short-lived HttpOnly browser-binding cookie.
4. State, browser binding, authorization code, session token, CSRF token, issuer, and subject are persisted only as SHA-256 digests; nonce and PKCE verifier are stored only inside a protected bounded challenge.
5. Callback consumes state atomically, claims an authorization-code digest once, verifies nonce, and creates a new session token unrelated to any incoming session cookie.
6. Session and login cookies are HttpOnly, SameSite=Lax, path `/`, bounded by Max-Age, and use `Secure` plus `__Host-` names outside localhost.
7. The session bootstrap route rotates the session and returns a session-bound CSRF token in a no-store response. Browser mutations require an exact configured Origin and the CSRF token.
8. Explicit rotation revokes the previous token. Logout revokes the active token and clears the cookie. Expired, revoked, and replaced sessions fail uniformly.
9. Provider identity output contains only issuer, opaque subject, and validated nonce. Tenant, principal, roles, and permissions are resolved from local `human_subjects`, `principals`, and `memberships`.
10. A provider subject mapping to zero or multiple active tenants fails closed. A future tenant selector requires a separate reviewed increment.
11. Audit events contain only tenant/principal/session/request IDs, event type, outcome, and a closed reason code. Pre-tenant failures are bounded aggregates. Tokens, codes, cookies, issuer/subject values, free-form claims, and PII are forbidden.
12. The deterministic provider, deterministic secret protector, and in-memory repository are test-only; production mode rejects test provider/protector implementations.
13. Enabling the BFF requires an explicitly approved provider adapter, exact public origin, repository, and secret protector. Default configuration is disabled.
14. Existing service Bearer authentication remains unchanged and available only to service/integration clients.
15. No productive IdP product, client, secret, issuer, tenant, callback registration, or deployment is selected by this feature.

## Routes

| Route | Method | Purpose |
|---|---|---|
| `/auth/login` | GET | create single-use login state and redirect to injected provider |
| `/auth/callback` | GET | consume state/code, resolve local membership, issue BFF session |
| `/auth/session` | POST | authenticate and rotate session; return bounded role/permission view and CSRF token |
| `/auth/session/rotate` | POST | CSRF-protected explicit rotation |
| `/auth/logout` | POST | CSRF-protected revocation and cookie clearing |

All responses use `Cache-Control: no-store`; no route emits permissive CORS headers.

## Acceptance criteria

- Focused HTTP tests cover malformed state/code/nonce, missing browser binding, state/code replay, fixation, CSRF, rotation, logout, revoked/expired sessions, ambiguous cross-tenant membership, local-role-only mapping, audit minimization, cookie policy, and service credential compatibility.
- Migration 017 applies after migrations 001–003.
- A disposable PostgreSQL gate passes with a non-owner `NOSUPERUSER/NOBYPASSRLS` runtime role and forced RLS.
- A compiled Node-to-PostgreSQL smoke passes through login, callback, session rotation, CSRF denial, logout, revocation, and replay denial.
- `EVAL-HUMAN-SESSION-BFF-001`, typecheck, build, full regression, schema validation, secret/PII scan, and diff checks pass.
- Browser journeys remain blocked and are not counted as authenticated.

## Explicit limitations

- No productive IdP has been selected, approved, configured, contacted, or provisioned.
- Feature 083 later adds a provider-neutral discovery/JWKS/token adapter; provider selection, registration, credentials and external interoperability remain human-approved decisions.
- No account recovery, invitation, enrollment, MFA policy, step-up authentication, tenant chooser, access review UI, or emergency administrator procedure exists.
- No authenticated product shell or browser journey is implemented by this feature.
- Local deterministic provider evidence is not external interoperability evidence.
- This feature is not production readiness.
