# Feature 083 — Provider-neutral OIDC adapter v1

Status: implemented and locally verifiable; no productive provider is selected or approved

## Goal

Provide a standards-shaped confidential OIDC adapter for the existing human-session BFF without coupling LA Muni RAG to a vendor, trusting provider authorization claims, committing credentials, or representing local tests as productive authentication.

## Functional requirements

1. Human sessions remain disabled by default.
2. Environment composition fails closed unless enablement and provider approval are both explicit and every required server-side secret and identifier is present.
3. The configured issuer is an exact HTTPS URI. Discovery uses the OIDC well-known path, including issuers with path components.
4. Authorization, token and JWKS endpoints must use HTTPS and an explicit exact-origin allowlist. Redirect following is forbidden.
5. Authorization uses response type `code`, scope `openid`, state, nonce and PKCE S256.
6. Token exchange uses POST, a bounded form body, the exact callback URI and either `client_secret_basic` or `client_secret_post` selected by closed configuration.
7. Discovery, token and JWKS responses are content-type checked and byte bounded. Network requests have bounded timeouts.
8. ID tokens accept only RS256, PS256 or ES256 from an explicit allowlist. Unsigned and symmetric algorithms are rejected.
9. JWKS accepts only public RSA or EC verification keys with a bounded key count and rejects private, symmetric or embedded-header key material.
10. Verification requires signature, exact issuer, audience, authorized party where applicable, subject, nonce, `iat`, `exp`, bounded lifetime and non-future issuance.
11. The adapter returns only issuer, opaque subject and nonce. Provider roles, groups, tenant, email, name and profile claims cannot grant application permission.
12. The BFF performs the constant-time nonce match and resolves issuer/subject digests through local memberships.
13. Ordinary authorization rejection maps to a generic 401. Provider timeout, 429 or 5xx maps to a generic 503 and requires a fresh login.
14. Discovery and JWKS are cached for bounded periods; one bounded JWKS refresh is allowed for rotation-related key mismatch.
15. Client secret and protector key remain server-only and non-enumerable from the composed objects.
16. Existing service Bearer authentication remains separate and unchanged.

## Acceptance criteria

- `npm run test:human-oidc-provider` passes.
- `npm run eval:human-oidc-provider` passes.
- Existing BFF, reliability and workspace focused tests and named EVALs pass.
- Typecheck, build and applicable full regression pass.
- Dependency audit, structured validation, secret/PII scan and `git diff --check` pass.
- CI runs the focused and named Feature 083 gates.
- Productive authenticated journeys remain `0/12`.

## Explicit limitations

- This feature does not select, provision or approve an identity provider.
- No client registration, redirect registration, productive credential, provider metadata receipt or external interoperability run exists.
- MFA, enrollment, recovery, step-up, access review, emergency access and provider administration remain governance decisions.
- DNS and egress controls, certificate policy, managed secret storage, rotation and productive monitoring belong to deployment operations and remain absent.
- This feature is not production readiness.
