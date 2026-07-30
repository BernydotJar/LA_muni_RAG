# ADR 083 — Provider-neutral confidential OIDC adapter

Status: accepted for local implementation
Date: 2026-07-28

## Decision

Implement a provider-neutral confidential OIDC adapter behind the existing human-session interface. The repository supplies protocol validation and fail-closed composition but does not choose a vendor or authorize productive use.

The adapter uses authorization code plus PKCE S256, server-side client authentication, exact issuer and audience validation, an asymmetric algorithm allowlist, bounded discovery/JWKS/token reads and exact endpoint-origin allowlists. Provider claims are reduced to issuer, subject and nonce. Local memberships remain the sole source of tenant and role authorization.

Productive activation requires both `HUMAN_SESSION_ENABLED=true` and `HUMAN_SESSION_PROVIDER_APPROVED=true`, plus complete server-side configuration. Missing or malformed configuration stops server composition instead of degrading to an anonymous or test identity path.

## Alternatives rejected

- **Browser Bearer or access-token storage:** rejected because it expands credential exposure and bypasses the BFF boundary.
- **Trusting provider groups or roles:** rejected because external claims cannot establish LA Muni RAG tenant membership or application authorization.
- **Dynamic unrestricted discovery endpoints:** rejected because metadata-controlled redirects and endpoints create SSRF and trust-substitution risk.
- **Remote JWKS convenience without bounds:** rejected because redirects, oversized responses and embedded keys weaken the verification boundary.
- **Vendor SDK selection:** deferred because provider choice, procurement, data terms and credentials require an explicit human decision.

## Consequences

The codebase now has a production-shaped protocol adapter and an executable configuration path. It still has no productive IdP, registration, credentials, external user, managed environment or authenticated productive journey. The official result remains 0/12.
