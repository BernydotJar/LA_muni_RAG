# Productive human identity provider decision

Status: pending human decision
Packet ID: `HDP-IDP-001`

## Decision required

Approve, reject or defer a specific productive human identity provider and bounded operating model for LA Muni RAG. The decision must name the approved environment, tenant/account ownership, client registration, callback origins, identity assurance, provisioning/revocation, recovery, privacy/legal terms and operational owner.

No action is authorized by this packet alone.

## Current evidence

- Feature 077 provides a provider-neutral BFF/session foundation with state plus browser binding, nonce, PKCE S256, single-use code/state, rotating/revocable HttpOnly sessions, CSRF and local membership/role mapping.
- Feature 078 provides a same-origin role-aware shell and rejects browser Bearer credentials.
- Feature 079 provides privacy-minimized local telemetry and bounded recovery/load evidence.
- Deterministic adapters are test-only and prohibited in production mode.
- No productive provider, client registration, credential, discovery/JWKS/token adapter, MFA/recovery policy, user lifecycle or external interoperability receipt exists.
- Productive authenticated browser journeys remain `0/12`.

## Options

### Option A — Approve a named provider and bounded pilot

The receipt must identify the provider and account/tenant owner, authorize only the stated non-production environment, and constrain client registration, redirect URIs, credentials, users, data regions and duration. Production remains separately gated.

### Option B — Approve a named provider for managed staging and production preparation

The receipt must also approve legal/privacy terms, identity assurance, MFA, recovery, provisioning/deprovisioning, access review, incident/key rotation, support ownership and a separate production go-live gate. This option does not itself authorize production release.

### Option C — Defer provider selection

Keep the BFF disabled by default and continue only provider-neutral contracts, local test adapters, decision analysis and non-identity-dependent development.

### Option D — Reject external productive identity for this project phase

Document the alternative operating model and its security/privacy consequences. Service Bearer credentials cannot be repurposed as human browser identity.

## Evaluation criteria

- standards interoperability: authorization code flow, PKCE, OIDC discovery, issuer/audience/nonce validation, JWKS and key rotation;
- separation of test, staging and production clients/credentials;
- MFA strength, recovery, account takeover and help-desk controls;
- provisioning, deprovisioning, suspension, access review and local membership mapping;
- tenant/account ownership and administrative break-glass model;
- regional processing, subprocessors, retention, deletion, audit and contract terms;
- rate limits, outage behavior, support and incident notification;
- secret storage, rotation, callback origin governance and environment isolation;
- accessibility and user experience for approved municipal users;
- total cost and billing authority.

## Preconditions

- named product, security, privacy/legal and operations authorities;
- approved environment and exact callback origins;
- approved client ownership and secret-management path;
- threat/privacy review for provider metadata, profile claims and logs;
- local membership/provisioning design that does not trust IdP tenant/role claims;
- MFA, recovery, revocation and access-review runbooks;
- test plan for malformed discovery/JWKS/token responses, key rotation, provider outage, replay, account disablement and cross-tenant mapping;
- evidence/retention plan that excludes provider tokens and unnecessary profile data.

## Prohibited until approval

- selecting or announcing a productive provider;
- creating a provider tenant/account, client registration or credential;
- configuring productive discovery, issuer, JWKS, audience or callback values;
- onboarding real users or profile data;
- weakening the no-Bearer-browser or local-role-only authorization contract;
- counting deterministic-adapter execution as a productive authenticated journey;
- committing secrets or provider identifiers that expose a real environment.

## Acceptance evidence after approval

- decision receipt and provider configuration record with secrets redacted;
- exact issuer/client/callback configuration receipt by environment;
- external discovery/JWKS/token interoperability tests;
- MFA, recovery, revocation, deprovisioning and access-review evidence;
- provider outage/key rotation/failure-injection evidence;
- privacy/legal and operations approvals;
- real ephemeral authenticated browser journeys with local tenant/role mapping;
- no tokens, codes, cookies, profile PII or secrets in logs/errors/telemetry.

## Decision receipt

Create a separate receipt conforming to `contracts/decision-packets/v1/human-decision-receipt.schema.json` with:

- `packet_id: HDP-IDP-001`;
- approved/rejected/deferred outcome;
- authority roles and durable decision record reference;
- named provider only if approved;
- bounded environment, account/client ownership and callback origins;
- explicitly approved actions and expiration/review date;
- security, privacy/legal, operations and cost constraints;
- evidence required before any later production gate.
