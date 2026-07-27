# Feature 077 independent implementation review

Date: 2026-07-27
Review model: Producer → Critic / Red Team → Fixer → Independent Verifier → Release Gate

## Producer result

Implemented a disabled-by-default provider-neutral BFF with state, browser binding, nonce, PKCE S256, code replay prevention, local membership resolution, rotating/revocable server-side sessions, CSRF, minimized audit, migration 017, test-only deterministic adapters, and PostgreSQL repository functions.

## Critic / Red Team findings

1. **Login CSRF would remain possible with state alone.** Required a separate browser-bound HttpOnly value tied to the transaction digest.
2. **A session created at callback had no safe way to expose the CSRF value after redirect.** Required session bootstrap to rotate the session and return a fresh CSRF token in a no-store body.
3. **Provider tenant/role claims could become an accidental authorization input.** Required the provider interface to exclude authorization claims and the repository to resolve roles solely from local memberships.
4. **A subject mapped to multiple tenants would be ambiguous.** Required exactly one active local mapping; zero or multiple rows fail closed.
5. **A deterministic provider/protector could be accidentally composed in production.** Required explicit test-only types and production guards.
6. **Pre-tenant audits could capture sensitive input.** Required bounded aggregate failure buckets with closed reason codes and no request content.
7. **Direct table access before tenant resolution could bypass RLS semantics.** Required fixed-search-path security-definer functions and revoked PUBLIC privileges.
8. **Docker evidence was unavailable in the workspace.** Required an independent local PostgreSQL 15.18 + pgvector 0.8.5 gate rather than treating Docker failure as SQL evidence.

## Fixer changes

- added the browser-binding cookie/digest to login and callback;
- made callback clear fixation input and issue an unrelated session;
- made `/auth/session` rotate the token and return the new CSRF value;
- added exact Origin plus CSRF checks to rotation and logout;
- added provider-local role separation and ambiguous-membership denial;
- added production guards and strict enabled configuration;
- added forced-RLS schema, replay/session functions, closed audits and failure aggregation;
- added HTTP adversarial tests, static migration tests, non-owner SQL gate, and compiled database smoke.

## Independent verifier evidence

- focused lifecycle and migration suite: 20/20 passing;
- `EVAL-HUMAN-SESSION-BFF-001`: 9/9 passing;
- integrated regression: 908 total / 905 passing / 0 failing / 3 explicit environment skips;
- TypeScript typecheck and backend build: passing;
- PostgreSQL migration chain 001, 002, 003, 017: passing;
- non-owner PostgreSQL 15.18 / pgvector 0.8.5 runtime gate: passing;
- compiled Node/PostgreSQL BFF smoke: passing;
- provider role and tenant injection in compiled smoke: ignored; local `viewer` / tenant A retained;
- browser Bearer acceptance: false;
- state replay, stale caller clock, old session after rotation, cross-origin/bootstrap CSRF, audit-sink compensation, and revoked session: rejected;
- contracts, source inventory, workflow template, JSON/YAML/JSONL, CI YAML, dependency audit, secret/PII scan, and `git diff --check`: passing;
- dependency audit: zero vulnerabilities.

Exact functional SHA, remote publication, PR and exact-SHA CI evidence are populated in the versioned program records after the implementation commit exists.

## Release-gate judgment

Current judgment: **local release gate passed; implementation candidate, not production ready**.

The foundation is safe to version and test. It must not be represented as productive authentication because no approved external IdP, productive adapter, authenticated role-aware shell, browser journey, managed deployment receipt, MFA/recovery policy, or production operational control exists.
