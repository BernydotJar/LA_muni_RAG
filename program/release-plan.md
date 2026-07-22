# LA Muni RAG — Release Plan

Updated: 2026-07-22T16:53:05Z

## Current release state

```text
functional_branch: feature/ephemeral-staging-e2e-architecture-v1
functional_sha: f4d018f0909d15408092167cb935bf4ac71cd6d9
remote_sha_verified: true
backend_ci: run 29939453123 success
pull_request: none
merged_to_main: false
staging_deployed: false
browser_e2e_executed: false
production_deployed: false
observation_window: none
```

## Feature 070 gates satisfied

- closed staging schema and canonical plan validate with zero issues;
- 13/13 `EVAL-EPHEMERAL-STAGING-E2E-001`;
- 2 synthetic tenants, 11 principals, exact 10-role matrix, 13 fixtures;
- 20 runnable API/system journeys and 12 explicitly blocked browser journeys;
- deterministic reset and destruction contract;
- OpenAPI method/status and route-permission alignment;
- secret, production-endpoint, RBAC, isolation, reset, layer, and overclaim guards;
- detached full suite 808 total / 806 pass / 0 fail / 2 skips;
- 30/30 canonical contracts, 2/5 consumer contracts, typecheck, build, and zero-vulnerability audits;
- exact remote SHA and Backend CI success.

## Required sequence before browser E2E

1. Implement and execute the local ephemeral staging runner.
2. Prove fresh database creation, migrations, identity/fixture seeding, twenty API/system journeys, sanitized artifact collection, and destruction.
3. Coordinate consumer-side contract tests in OS Electoral and Content Agency.
4. Approve and implement IdP/OIDC/PKCE/BFF/session architecture, provisioning, secure cookies, CSRF, logout, revocation, and recovery.
5. Build role-aware authenticated UI routes.
6. Enable the twelve browser journeys and collect browser, keyboard, screen-reader, and human accessibility evidence.

## Blocking release gates

- authorized real corpus acquisition and judged retrieval quality;
- human authority/vigencia/applicability review;
- actual ephemeral/staging execution and cleanup evidence;
- human identity/session and authenticated SaaS surfaces;
- external consumer conformance;
- production infrastructure, observability, load/HA, recovery, and privacy operations;
- reviewed PR, protected merge, deployment approvals, rollout, rollback, and observation.

## Release rule

An executable architecture, green feature branch, or disposable gate is not a release. Production readiness may be declared only when every blocking gate has immutable evidence and the deployed revision is observed. No automatic merge or deployment is authorized.
