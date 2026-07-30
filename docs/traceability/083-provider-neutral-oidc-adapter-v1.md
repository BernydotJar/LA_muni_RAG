# Feature 083 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Exact OIDC discovery | `src/humanSession/oidcAdapter.ts` | focused discovery tests and named EVAL |
| Endpoint-origin and redirect controls | OIDC adapter request and endpoint normalization | issuer/foreign endpoint red-team cases |
| Authorization code + PKCE | authorization URL and token form composition | focused request assertions |
| Confidential client authentication | closed basic/post modes | token-call assertions |
| Signature/issuer/audience/azp/time validation | jose verification plus bounded claims | claim-confusion test matrix |
| Public asymmetric JWKS only | JWKS validator and embedded-header rejection | malicious JWKS/header tests |
| Response and timeout bounds | streaming JSON reader and AbortController | oversized-response test and named EVAL |
| Provider failure taxonomy | `providerErrors.ts` and BFF handler | reliability focused test and workspace EVAL |
| Fail-closed environment composition | `src/humanSession/config.ts` and `src/server.ts` | configuration tests |
| Secret non-enumerability | AES and OIDC private fields | serialization assertion |
| Local membership authority | BFF issuer/subject digest lookup | BFF tests and named EVAL |
| CI and documentation | package scripts, Backend CI, ADR/risk/review | EVAL-HUMAN-OIDC-PROVIDER-001 |

## Named gates

- `npm run test:human-oidc-provider`
- `npm run eval:human-oidc-provider`
- `npm run test:human-session-bff`
- `npm run test:human-session-reliability`
