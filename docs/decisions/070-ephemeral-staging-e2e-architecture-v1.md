# Decision 070 — Stage deterministically before browser E2E

Date: 2026-07-22
Status: accepted for Feature 070

## Decision

Define staging and E2E as an executable contract before provisioning infrastructure or adding browser automation.

The contract requires:

- one isolated environment and fresh database per run;
- synthetic tenants, principals, fixtures, and runtime-injected ephemeral credentials;
- exact application RBAC and tenant-isolation checks;
- deterministic reset and mandatory destruction;
- API/system coverage for schema, auth, RLS, idempotency, persistence, retries, failures, and boundaries;
- browser coverage only for human session behavior, role-aware navigation, user feedback, accessibility, and critical user outcomes;
- browser journeys blocked until human IdP/BFF/session and authenticated UI prerequisites exist;
- OS Electoral and Content Agency represented only by provider-side contract stubs until their repositories run independent consumer suites.

## Rationale

Browser tests are expensive and diagnostically weak for lower-layer defects. Starting with E2E would create brittle automation around undefined identity, mutable data, and incomplete UI while hiding failures that belong to contracts, API authorization, RLS, persistence, or reset logic.

A committed machine-readable plan lets CI reject architecture drift without creating paid infrastructure, storing credentials, or overstating external interoperability.

## Consequences

- Feature 070 is architecture evidence, not deployed staging.
- Browser E2E remains intentionally disabled.
- Service Bearer credentials are never repurposed as browser credentials.
- Platform adapters must implement the declared lifecycle rather than inventing a second staging model.
- Consumer repositories must pin an immutable contract-kit SHA and provide their own evidence.
- Production release remains blocked by corpus, human identity, staging, operations, external consumers, review, merge, and deployment gates.
