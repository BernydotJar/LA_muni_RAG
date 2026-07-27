# Feature 078 independent implementation review

Date: 2026-07-27
Review model: Producer → Critic / Red Team → Fixer → Independent Verifier → Release Gate

## Producer result

Implemented a same-origin server-rendered shell boundary at `/app` with strict browser headers, fail-closed session states, POST-only BFF lifecycle, in-memory CSRF, local-permission navigation, responsive/accessibility foundations, and deterministic Chromium verification for `viewer` and `tenant_admin`.

## Critic / Red Team findings

1. **A public static Pages site must not become the authenticated application.** Required a distinct API-server route under the BFF origin and no public-site link or Pages artifact inclusion.
2. **Hidden navigation could be mistaken for authorization.** Required explicit documentation that backend RBAC/RLS remain authoritative and denied hash navigation falls back safely.
3. **Browser storage could silently become a token cache.** Required no localStorage, sessionStorage, IndexedDB, readable cookie, URL credential, DOM secret, or console output.
4. **A role name alone is an unstable UI contract.** Required module visibility from effective local permissions, with roles displayed only for accountability.
5. **The service-only `integration_client` role remained structurally available in the shared role enum.** Required a separate `HumanSecurityRole` type and TypeScript/PostgreSQL exclusions in resolution, creation, authentication and revocation.
6. **A permissive shell payload parser could render attacker-controlled capabilities.** Required exact UUID/opaque-token bounds and closed role/permission allowlists.
7. **Anonymous bootstrap produces an expected 401 browser-console resource message.** Required the smoke to allow that one known signal while failing every other console/page error.
8. **Deterministic login could be misreported as productive authentication.** Required explicit `test-only`, `0/12`, and non-production statements in output, docs, EVAL and program records.

## Fixer changes

- added server-only `/app` HTML/CSS/JS handling with no-store and strict same-origin headers;
- added bounded anonymous, unavailable, error and authenticated states;
- added POST bootstrap, rotation and logout with same-origin credentials and in-memory proof values;
- added closed role/permission payload validation and permission-bound route fallback;
- added service/human role type separation and migration/runtime exclusions for `integration_client`;
- added semantic landmarks, skip navigation, live status, visible focus, responsive breakpoints and reduced motion;
- added focused HTTP/static tests and real Chromium role-aware lifecycle smoke;
- kept the deterministic provider and all browser evidence explicitly non-productive.

## Independent verifier evidence

- shell HTTP/static focused suite: 8/8 passing;
- `EVAL-HUMAN-PRODUCT-SHELL-001`: 9/9 passing;
- Feature 077 lifecycle/migration regression after role hardening: 20/20 passing;
- deterministic browser smoke: Chromium, Firefox and WebKit passing for both `viewer` and `tenant_admin`;
- keyboard skip navigation, denied and malformed hash fallback, role-aware navigation, session rotation and logout revocation: passing;
- localStorage/sessionStorage/document-cookie exposure: zero;
- PostgreSQL 15.18 / pgvector 0.8.5 migration chain, non-owner forced-RLS runtime gate and compiled BFF smoke: passing;
- integrated regression: 925 total / 922 passing / 0 failing / 3 explicit environment skips;
- TypeScript typecheck and backend build: passing;
- contracts, source inventory, workflow template, JSON/YAML/JSONL, CI YAML, dependency audits, secret/PII scan and `git diff --check`: passing;
- dependency audit: zero vulnerabilities.

The exact functional SHA is populated in the versioned program records after the implementation commit exists. Remote publication, PR update and exact-SHA CI remain blocked by the disabled audited push capability.

## Release-gate judgment

Current judgment: **local release gate passed; implementation candidate, not production ready**.

The shell safely demonstrates local permission-aware BFF consumption. It does not establish a productive IdP, implement all module workflows, provide real ephemeral/browser-user evidence, or satisfy any of the twelve productive authenticated journeys.
