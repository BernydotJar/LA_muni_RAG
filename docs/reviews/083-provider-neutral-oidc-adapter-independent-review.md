# Feature 083 independent implementation review

Date: 2026-07-28
Disposition: **PASS WITH LIMITATIONS** for local provider-neutral implementation; not production readiness

## Producer result

The producer added a confidential OIDC adapter, fail-closed environment composition, exact endpoint-origin controls, bounded network reads, asymmetric ID-token verification and a closed provider failure taxonomy. The adapter projects only issuer, subject and nonce and leaves all authorization to local memberships.

## Critic / red-team findings

1. The first implementation constructed the well-known URL by appending to the issuer. This is incorrect for an issuer with a path component.
2. `iat` was required but not initially checked against future issuance.
3. The AES protector key used a TypeScript-private property that remained enumerable at runtime.
4. Existing reliability tests expected transient provider failure to be a generic 500, obscuring the intended unavailable taxonomy.
5. Unrestricted metadata endpoints, redirects, symmetric keys, embedded JWK headers, duplicate key IDs, algorithm confusion and provider role claims required explicit negative coverage.
6. The initial Basic authentication helper approximated form encoding instead of using the exact `application/x-www-form-urlencoded` algorithm.
7. Discovery initially tolerated an omitted PKCE advertisement and a missing token-auth-method advertisement for `client_secret_post`.
8. The first JWKS cache was not keyed by `jwks_uri`, which could reuse stale keys after a validated metadata change.

## Fixer result

- Discovery now inserts `/.well-known/openid-configuration` before the issuer path.
- Future `iat`, excessive lifetime and expiry are rejected within a bounded tolerance.
- AES and OIDC secrets use ECMAScript private fields.
- Transient provider failure is a bounded generic 503; ordinary authorization rejection remains a bounded generic 401.
- Focused tests exercise exact Basic credential encoding, explicit PKCE and client-auth metadata, issuer and endpoint substitution, 4xx/5xx taxonomy, audience/azp/time confusion, embedded keys, duplicate key IDs, incompatible algorithms, private/symmetric JWKS, response bounds, URI-bound caching and claim minimization.
- JWKS entries are restricted to unique public verification keys whose declared algorithm, when present, belongs to the configured asymmetric allowlist.

## Independent verifier

Final local evidence on the exact functional tree:

- Feature 083 focused suite: **10/10**.
- `EVAL-HUMAN-OIDC-PROVIDER-001`: **9/9**.
- Existing BFF: **20/20**; reliability: **5/5**; workspace: **6/6**.
- Full regression: **997 total / 995 pass / 0 fail / 2 explicit environment skips**.
- Public browser gate: **10/10**.
- Authenticated deterministic shell: Chromium, Firefox and WebKit passed; productive journey claim remains **0/12**.
- Typecheck and build: pass.
- Decision packets, integration contracts, consumer kits and source inventory: valid.
- Dependency audits, including production-only audit: **0 vulnerabilities**.
- Reliability harness: 160 BFF events, zero unexpected failures, no productive SLO claim.
- JSON/YAML/JSONL validation, dependency-tree check and `git diff --check`: pass.
- Secret/PII scan: 1,398 added lines scanned with no findings.

The current recreated runtime has the PostgreSQL client but no server binary or disposable cluster. Feature 083 changes no schema or persistence; migration and persistence contract tests remain green in the full regression. The prior real PostgreSQL 15.18/pgvector evidence for Feature 077 remains historical evidence and was not falsely rerun for this feature.

## Limitations

This feature does not select, provision or approve an IdP. It contains no productive registration, credentials, external interoperability receipt, MFA/recovery/access-review operation, managed secret store, productive egress policy, external user or managed browser environment. Productive authenticated journeys remain 0/12. This is not production readiness.
