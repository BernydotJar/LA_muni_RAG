# LA Muni RAG — Open Issues

Updated: 2026-07-22T16:53:05Z

## Closed locally by Feature 070

- A closed machine-readable ephemeral staging/E2E plan exists and validates with zero issues.
- Exact RBAC, deterministic tenants/principals/fixtures, reset order/postconditions, API/OpenAPI alignment, route permissions, tenant isolation, mock boundaries, and API-versus-browser ownership are executable gates.
- Twenty API/system journeys are runnable by contract.
- Twelve browser journeys cover the required human roles and remain explicitly blocked.
- Secret-like material, production endpoints, permission drift, reset weakening, browser misuse, and external-consumer overclaims fail closed.
- Functional SHA `f4d018f0909d15408092167cb935bf4ac71cd6d9` is published and Backend CI `29939453123` succeeded.
- Detached verification passed 808/806/0/2, 13/13 staging eval, 30/30 canonical contracts, 2/5 consumer contracts, typecheck, build, and two zero-vulnerability audits.

No PR, merge, staging deployment, browser execution, or production deployment exists.

## Critical open work

### Ephemeral execution

1. The Feature 070 lifecycle is specified but no platform runner currently provisions and destroys the environment.
2. The twenty API/system journeys have not executed against independently deployed ephemeral services.
3. Run receipts, timing, fault injection, cleanup attestation, and sanitized artifact collection remain to be implemented.

### Human identity and browser E2E

1. IdP/OIDC/PKCE/BFF/session architecture is not approved or implemented.
2. Secure cookies, CSRF, logout, revocation, recovery, provisioning, and periodic access review are absent.
3. Authenticated role-aware UI routes are absent.
4. All twelve browser journeys are intentionally blocked and have not executed.
5. Supported-browser, screen-reader, and human WCAG 2.2 AA evidence is absent.

### External consumers

1. OS Electoral has not pinned or executed the provider contract kit in its own repository.
2. Content Agency has not pinned or executed the provider contract kit in its own repository.
3. Cross-product persistence, retries, expiry, revocation, supersession, and independent-store behavior remain unproved.

### Corpus and legal review

1. No authorized durable source bytes are present and zero real documents are credited as ingested.
2. No real-corpus retrieval, citation, latency, cost, or load evaluation exists.
3. Human review of authority, vigencia, jurisdiction, supersession, applicability, and contradictions remains mandatory.

### Production platform and release

1. Terraform, workload identity, production secrets, object store, scanner, dispatcher, observability, SLOs, alerts, staging, load/HA, and coordinated recovery are absent.
2. Privacy retention, deletion, legal hold, and DSAR operations are absent.
3. No reviewed PR, protected merge, deployment approval, deployment, rollback rehearsal, or observation window exists.

## Next safe autonomous task

`WS10-EPHEMERAL-STAGING-RUNNER-001` — implement a local disposable runner for the Feature 070 contract using only generated credentials and synthetic fixtures. It must execute and attest the twenty API/system journeys, collect sanitized receipts, and destroy all state. Browser E2E remains blocked until the human identity and authenticated UI prerequisites are satisfied.
