# Human session and BFF security contract

Status: local provider-neutral foundation implemented; productive IdP and authenticated product UI absent
Last reviewed: 2026-07-27

## Trust boundaries

Human browser identity and integration identity are independent mechanisms:

- `/auth/*` accepts only opaque BFF cookies and never accepts an `Authorization` header;
- `/api/v1/*` service/provider routes retain opaque Bearer authentication and do not treat browser cookies as service credentials;
- OIDC output is authentication evidence only. `issuer` and `subject` are hashed, mapped to an active local user principal, and authorized through `identity.memberships`;
- a provider role, tenant, group, email, display name, or other free-form claim cannot grant an application role.

## Login lifecycle

1. `GET /auth/login` creates random state, nonce, PKCE verifier, and browser-binding values.
2. Only digests of state and browser binding are stored. Nonce and verifier are sealed by the configured protector.
3. The browser-binding value is set in a short-lived HttpOnly SameSite=Lax cookie. Any existing BFF session cookie is cleared to prevent fixation.
4. The provider adapter must produce an HTTPS authorization URL containing the exact state, nonce, challenge, and `S256` method.
5. `GET /auth/callback` requires one syntactically valid state, one bounded code, and the matching browser-binding cookie.
6. State is consumed atomically. The authorization-code digest is claimed once before exchange.
7. The adapter returns a validated issuer, opaque subject, and nonce. The BFF compares nonce using fixed-length SHA-256 values.
8. The issuer/subject digests resolve exactly one active local human membership. Zero or multiple mappings fail closed.
9. A fresh random session token and CSRF token are issued. Only their digests are persisted.

## Cookie policy

The session and login-binding cookies are:

- `HttpOnly`;
- `SameSite=Lax`;
- `Path=/`;
- bounded by `Max-Age`;
- `Secure` with `__Host-` names for HTTPS origins;
- emitted without `Domain`;
- local non-Secure names only for exact localhost HTTP test/development origins.

Session lifetime is at most eight hours. Login transactions are at most ten minutes and default to five minutes.

## Session and CSRF lifecycle

`POST /auth/session` authenticates the current token, atomically replaces it, and returns the local role/permission view plus a new CSRF token. The replacement cookie is HttpOnly; the CSRF value exists only in the no-store response and as a digest in the database.

`POST /auth/session/rotate` and `POST /auth/logout` require:

- the active session cookie;
- exact `Origin` equality with the configured public origin;
- a bounded `x-csrf-token` whose digest matches the active session.

Rotation revokes the old token and creates the next generation. Logout revokes the active token and clears the cookie. Expired, revoked, replaced, malformed, or unknown sessions return the same bounded authentication failure.

## Persistence and least privilege

Migration 017 creates:

- `identity.human_subjects` — opaque provider/subject digests mapped to local user principals;
- `identity.human_login_transactions` — state/browser-binding digests and protected challenge;
- `identity.human_authorization_code_claims` — single-use code digests;
- `identity.human_sessions` — session/CSRF digests, generation, expiry, revocation, and replacement link;
- `identity.human_auth_failure_buckets` — bounded pre-tenant failure aggregates.

Tenant-owned subject and session tables use enabled and forced RLS. Pre-tenant operations are exposed only through fixed-search-path `SECURITY DEFINER` functions with closed input validation. The tested runtime role is non-owner, `NOSUPERUSER`, and `NOBYPASSRLS`.

## Audit minimization

Tenant audit permits only:

- tenant ID;
- principal ID;
- session ID;
- request ID;
- closed event type;
- success/blocked outcome;
- closed reason code.

Pre-tenant failure storage contains minute bucket, reason code, count, first request ID, and update time. The following are forbidden in audit, logs, errors, URLs, or traces: raw state, nonce, verifier, authorization code, session/CSRF cookie, issuer, subject, provider token, claims, names, email addresses, and request bodies.

## Fail-closed configuration

The default server exposes the routes but returns bounded 503 responses. Enabling requires all of:

- `approvedProvider: true` from a reviewed deployment composition;
- provider adapter;
- exact public origin;
- session repository;
- secret protector.

The repository does not infer a productive provider from environment variables. `NODE_ENV=production` rejects the deterministic provider and deterministic protector. No productive IdP, client credential, issuer, redirect registration, discovery document, or JWKS endpoint is committed.

## Remaining security gates

The twelve authenticated browser journeys remain blocked (`0/12` authenticated). The deterministic adapter is executable test evidence only and cannot satisfy the external IdP or role-aware UI prerequisites.

Before productive use, humans must approve the IdP, tenancy model, MFA/step-up policy, enrollment/recovery, role administration, access review, emergency access, session/failure retention, purge, monitoring, incident response, privacy terms, and deployment topology. The productive adapter must validate discovery metadata, issuer, audience, signature, algorithm, nonce, code exchange endpoint, token time bounds, and transport trust. These requirements are not satisfied by the deterministic test adapter.
