# Feature 083 risk register

| Risk | Control in this feature | Residual / required follow-up |
|---|---|---|
| Issuer or endpoint substitution | Exact issuer equality; exact HTTPS endpoint-origin allowlist | Human review of provider metadata and deployment egress policy |
| Metadata redirect or SSRF | `redirect: error`, HTTPS-only URLs, bounded origins and responses | DNS rebinding/private-network egress requires platform controls |
| Algorithm confusion | Closed RS256/PS256/ES256 allowlist; jose signature verification | Provider key and algorithm policy must be approved |
| Malicious JWKS | RSA/EC public keys only; bounded key count; unique `kid`; compatible algorithm; private/symmetric fields rejected; cache bound to exact JWKS URI | Productive key rotation and outage runbook absent |
| Embedded attacker key | `jku`, `x5u`, `jwk` and `crit` rejected | Continue dependency and protocol review |
| Audience or cross-client confusion | Exact audience and `azp` validation | Productive client registration receipt absent |
| Stale/future token | `exp`, `iat`, lifetime and bounded clock tolerance | Productive time synchronization monitoring absent |
| Nonce replay or substitution | ID-token nonce required; BFF constant-time comparison; state/code replay fences | External interoperability not yet executed |
| Provider claims escalate privilege | Adapter returns only issuer/subject/nonce; local membership resolution | Access-review and emergency-access operations absent |
| Secret disclosure | Server-only configuration; AES key and client secret use private fields; no logging | Managed secret store and rotation not configured |
| Provider outage appears as internal fault | Closed 503 unavailable taxonomy, fresh login and minimized telemetry | Productive alerting, SLO and on-call absent |
| Local tests overclaimed as productive identity | Explicit 0/12 boundary and no committed provider selection | Human approval and external receipt required |
