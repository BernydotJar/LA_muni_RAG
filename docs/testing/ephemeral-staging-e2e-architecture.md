# Ephemeral staging and E2E architecture v1

Status: executable provider-side architecture; no deployed staging or browser E2E is claimed.

## Purpose

Feature 070 defines the deterministic test architecture that must exist before browser E2E is enabled. The machine-readable source is:

```text
contracts/staging/v1/ephemeral-staging-plan.schema.json
contracts/staging/v1/ephemeral-staging-plan.json
```

Run:

```bash
npm run staging:verify
npm run eval:staging-e2e-architecture
```

The verifier checks the schema, canonical RBAC map, OpenAPI routes, tenant isolation, reset coverage, secret/production-input guards, mock boundaries, and the API-versus-browser policy.

## Environment lifecycle

The plan requires one isolated environment per run:

```text
preflight
create environment
migrate fresh database
seed identity
seed deterministic domain fixtures
verify API/system journeys
assert browser blockers
collect sanitized artifacts
destroy environment
```

The environment has a 120-minute maximum TTL, uses loopback-only networking, a fresh database per run, no production credentials, no production data, and mandatory destruction. A future platform adapter may implement these steps, but it must preserve the same contract and postconditions.

## Test identity

Current browser authentication remains blocked. The repository has service/integration Bearer credentials, not a human browser session model. Therefore:

- committed files contain only credential references, never raw values;
- raw ephemeral credentials are injected at runtime and persist only as server-side digests;
- browser credentials, local-storage tokens, passwords, session cookies, refresh tokens, private keys, signed URLs, and production endpoints are forbidden;
- browser journeys remain blocked by `BLK-HUMAN-IDP-BFF-001` and `BLK-AUTHENTICATED-UI-001`;
- enabling browser E2E requires an approved IdP/OIDC/PKCE/BFF/session design, secure cookies, CSRF, logout, revocation, recovery, and role-aware UI.

## Deterministic tenants and fixtures

The plan has two synthetic tenants with stable UUIDs. Every principal and fixture is tenant-owned, synthetic, non-authoritative, and resettable by recreating the database.

Fixture classes include:

- sources and documents;
- ingestion jobs;
- evidence bundles;
- workflow versions;
- procedure cases;
- evidence-gap and ClaimPack snapshots.

No fixture is municipal evidence, production data, legal authority, or proof of corpus quality. The reset verifier requires coverage for every mutable fixture type.

## Role matrix

The plan imports the canonical permission map from `src/security/rbac.ts` and fails if either the role set or permissions drift.

| Role | API coverage | Future browser coverage |
|---|---:|---:|
| `platform_admin` | required | required |
| `tenant_admin` | required | required |
| `document_manager` | required | required |
| `researcher` | required | required |
| `procedure_author` | required | required |
| `procedure_reviewer` | required | required |
| `procedure_approver` | required | required |
| `case_operator` | required | required |
| `viewer` | required | required |
| `integration_client` | required | not a browser persona |

Separation of duties is retained: authoring, review, and approval use separate principals and permissions.

## API/system journeys

Twenty runnable journeys cover:

- uniform unauthenticated 401;
- permitted viewer search;
- uniform cross-tenant 403 plus RLS;
- forbidden ingestion for a viewer;
- source and document registration;
- ingestion enqueue;
- semantic-provider fail-closed behavior;
- ProcedureQuery success, exact replay, and replay conflict;
- ClaimPack success and content-boundary denial;
- workflow draft, review, and approval separation;
- procedure-case creation;
- post-reset empty-state verification.

Every API journey references a method/path present in canonical OpenAPI.

## Browser journeys

Twelve planned browser journeys cover only user-visible outcomes:

- login/session lifecycle;
- viewer search and evidence feedback;
- document-manager ingestion flow;
- workflow separation of duties;
- case-operator lifecycle;
- tenant-admin identity surface;
- platform-admin operational navigation;
- researcher evidence review;
- procedure-reviewer review surface;
- procedure-approver approval surface;
- safe cross-tenant deep-link denial;
- keyboard, screen-reader, and accessibility behavior.

Browser E2E remains blocked. All twelve planned journeys are explicitly blocked, and the manifest cannot mark them runnable while the human identity and authenticated UI blockers remain.

## API versus browser decision rule

| Concern | Required layer |
|---|---|
| JSON Schema, OpenAPI, request/response contracts | API/unit/contract |
| Bearer parsing, authorization, tenant matching, RLS | API/integration/database |
| Idempotency, replay conflict, persistence, retries | API/system |
| Provider failure and contract boundaries | API/system |
| Reset integrity and fixture isolation | system/database |
| Secure session cookie and CSRF | browser plus server integration |
| Role-aware navigation and user feedback | browser |
| Keyboard/screen-reader behavior | browser plus human accessibility review |
| Critical end-user workflow | browser smoke after lower layers pass |

A browser test must not be added merely to validate schemas, RLS, idempotency, persistence, retry logic, or product boundaries. Those defects belong to faster and more diagnostic lower layers.

## Mock strategy

| Target | Mode | Claim allowed |
|---|---|---|
| Query embedding provider | deterministic loopback stub | provider integration mechanics only |
| Object storage | boundary stub | no durable-storage or production claim |
| Malware scanner | boundary stub | no clean-scan or definitions-monitor claim |
| OS Electoral | contract stub only | provider contract only; external repo untested |
| Content Agency | contract stub only | provider contract only; external repo untested |
| Human IdP | explicit blocker | not implemented |

OS Electoral and Content Agency repositories are not modified by this slice. Their consumer-side tests, independent persistence, retry, expiry, revocation, and supersession behavior remain unverified.

## Exit criteria for enabling browser E2E

Browser E2E may be enabled only when all of these are true:

1. human IdP/OIDC/PKCE/BFF/session architecture is approved and implemented;
2. secure cookies, CSRF, logout, revocation, and recovery pass server/browser tests;
3. deterministic tenants, principals, fixtures, and reset are deployed in isolated ephemeral services;
4. API/system journeys pass against those deployed services;
5. role-aware UI routes exist;
6. no production credential or production data is used;
7. external consumer status remains separately reported;
8. browser suite remains small and bounded to critical user outcomes.

Passing Feature 070 proves architecture conformance only. It does not prove deployed staging, browser E2E, external consumer interoperability, production readiness, legal correctness, real-corpus quality, load, HA, recovery, privacy operations, merge, or deployment.
