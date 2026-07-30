# ADR 077 — Provider-neutral human session/BFF foundation

Date: 2026-07-27
Status: accepted for local foundation; productive provider decision pending

## Context

LA Muni RAG already authenticates service and integration clients through opaque Bearer credentials, resolves tenant-local roles, enforces permissions, and binds PostgreSQL RLS. That credential model is inappropriate for a browser: exposing service credentials to JavaScript would erase the separation between human sessions and integrations, complicate revocation, and create avoidable token theft risk.

The staging architecture identifies human IdP/OIDC/PKCE/BFF/session and an authenticated role-aware UI as prerequisites for twelve browser journeys. No productive IdP selection is authorized.

## Decision

Adopt a backend-for-frontend session boundary with these properties:

- an injected provider adapter owns productive OIDC protocol details;
- state, nonce, PKCE S256, and an HttpOnly browser-binding cookie bind login initiation and callback;
- authorization codes and state are single-use;
- the provider returns only validated issuer, opaque subject, and nonce;
- application tenant, principal, roles, and permissions are resolved from local governed tables, never provider role/tenant claims;
- browser sessions use opaque cookies whose values are stored only as SHA-256 digests;
- session bootstrap and explicit rotation replace the token and CSRF secret; logout revokes it;
- browser mutations require exact Origin plus a session-bound CSRF token;
- service Bearer credentials remain a separate compatibility path and are rejected on browser routes;
- the default configuration is disabled, and enabled configuration requires an explicitly approved adapter, exact origin, repository, and protector;
- deterministic provider/protector/repository implementations are test-only and forbidden in production mode.

## Alternatives rejected

### Put service Bearer tokens in browser storage

Rejected. It would make integration credentials human-session material, expose them to JavaScript and browser extensions, and weaken independent rotation/revocation.

### Trust OIDC role or tenant claims directly

Rejected. External claim configuration is not the product authorization system. Role mapping remains separately governed in `identity.memberships`.

### Stateless signed browser token

Rejected for this slice. Immediate revocation, replacement/fixation protection, access review, and bounded audit are clearer with server-side session state.

### Select a productive IdP now

Rejected as human-gated. Product, security, privacy, procurement, tenancy, recovery, MFA, regional processing, and incident ownership decisions are absent.

## Consequences

Positive:

- no Bearer credential enters browser code;
- revocation and rotation are immediate;
- provider claims cannot elevate product roles;
- ambiguous multi-tenant mappings fail closed;
- local deterministic tests can exercise the complete BFF lifecycle.

Costs and residual work:

- Feature 083 later implements generic discovery/JWKS/token validation; productive provider selection, registration, credentials and interoperability remain approval-gated;
- multi-tenant human selection, enrollment, recovery, MFA/step-up, access review, and role-aware UI remain separate increments;
- the twelve authenticated browser journeys remain blocked;
- server-side session persistence and audit add operational state requiring retention, purge, monitoring, backup, and incident procedures.
