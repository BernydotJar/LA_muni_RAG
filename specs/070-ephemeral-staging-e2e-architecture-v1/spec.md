# Feature 070 — Ephemeral staging and E2E architecture v1

Status: approved for autonomous implementation within LA Muni RAG

## Goal

Publish an executable, provider-side specification for an isolated ephemeral staging environment and the future E2E test architecture. The specification must define test identity, deterministic fixtures, reset semantics, journeys, role coverage, mock boundaries, and the rule for choosing API/system versus browser tests.

This slice does not provision external infrastructure, implement human authentication, modify OS Electoral or Content Agency, or claim that cross-repository consumer tests have run.

## Functional requirements

1. A closed JSON Schema draft 2020-12 must validate the staging plan.
2. The canonical plan must declare per-run isolation, finite TTL, destruction after execution, no production credentials, and no production data.
3. Test identity must use runtime-injected ephemeral service credentials only. Raw credentials, passwords, session cookies, refresh tokens, private keys, signed URLs, and production endpoints are forbidden in committed artifacts.
4. Browser authentication must remain explicitly blocked until a human IdP/OIDC/PKCE/BFF/session architecture is approved and implemented.
5. The exact ten application roles and their permission sets must match `src/security/rbac.ts`.
6. At least two deterministic synthetic tenants must exist. Cross-tenant fixtures and negative journeys must prove non-leaking denial.
7. Fixtures must use deterministic identifiers, declare ownership, and remain synthetic/non-authoritative.
8. Reset must recreate isolated state, seed identity before domain fixtures, verify tenant isolation, collect only sanitized artifacts, and destroy the environment.
9. Every mutable fixture resource type must be covered by reset semantics.
10. API/system journeys must cover authentication, authorization, tenant isolation, idempotency, replay conflict, provider failure, workflow separation of duties, case operations, and reset verification.
11. Browser journeys must be limited to user-visible session, navigation, feedback, accessibility, and critical workflow outcomes. They must remain blocked while browser identity/UI prerequisites are absent.
12. OpenAPI paths and methods used by API journeys must exist in the canonical OpenAPI document.
13. API journeys must not be assigned to the browser merely to test schemas, RLS, idempotency, persistence, retries, or contract boundaries.
14. Mocks for OS Electoral and Content Agency must be contract stubs only and must explicitly state that external interoperability is not proven.
15. The query embedding provider may use a deterministic local stub. Object storage, malware scanning, and human IdP may only be boundary stubs/blockers; they cannot be presented as production equivalents.
16. A CLI must validate the canonical plan and emit a deterministic execution summary.
17. CI must run the staging-plan verifier and a named hard eval.
18. Documentation must distinguish executable architecture evidence from deployed staging, browser E2E, external consumer verification, and production readiness.

## Acceptance criteria

- Canonical plan validates with zero issues.
- Role/permission drift fails closed.
- Missing tenant-isolation journey fails closed.
- Uncovered mutable fixture types fail closed.
- Raw secret-like material and production URLs fail closed.
- Browser misuse for API-owned concerns fails closed.
- Browser journeys without explicit identity/UI blockers fail closed.
- External consumer mocks claiming verification fail closed.
- Unknown API routes or methods fail closed.
- Focused tests, typecheck, build, canonical contracts, full regression, dependency audits, and CI pass.

## Explicit limitations

- No human browser login, session cookie, CSRF, provisioning, recovery, or role-aware SaaS UI is implemented.
- No ephemeral cloud environment is provisioned by this slice.
- No production object store, scanner, dispatcher, IdP, secrets, or credentials are used.
- OS Electoral and Content Agency repositories are not modified and are not claimed as tested.
- Browser E2E remains the final layer after identity, deterministic fixtures, deployed ephemeral services, and system/API journeys are stable.
