# Feature 077 risk and threat review

Date: 2026-07-27
Scope: provider-neutral human session/BFF foundation only

| Threat / failure | Control implemented | Verification | Residual risk / next gate |
|---|---|---|---|
| Login CSRF / attacker-selected account | random state plus separate HttpOnly browser-binding cookie; both digests must match one unconsumed transaction | malformed/missing binding tests; PostgreSQL consume-once gate | productive IdP UX and callback registration not tested |
| Authorization-code replay | provider-scoped SHA-256 code claim with unique key before exchange | cross-transaction replay test and SQL gate | provider retry/error semantics require approved adapter review |
| Nonce substitution | protected expected nonce; bounded validated provider nonce; fixed-length digest comparison | malformed and mismatched nonce tests | productive ID-token validation absent |
| PKCE bypass | S256 challenge checked in adapter contract; verifier protected at rest | deterministic adapter rejects verifier mismatch; authorization URL assertions | productive provider support/interoperability absent |
| Session fixation | login clears incoming session; callback issues unrelated token; bootstrap and explicit rotation revoke predecessor | fixation and old-token tests | concurrent-tab rotation UX needs shell testing |
| Session theft persistence | opaque token stored only as digest; bounded 8-hour maximum; rotation/revocation | migration assertions, HTTP tests, SQL gate | device binding and risk-based reauthentication not implemented |
| CSRF on mutation | exact Origin plus session-bound CSRF digest | missing/wrong origin and token tests | reverse-proxy origin normalization needs deployment review |
| Cross-tenant access | provider subject resolves local membership; ambiguous multi-tenant mapping fails closed; forced RLS | two-tenant ambiguity test and non-owner RLS gate | tenant chooser and multi-tenant human UX absent |
| Role escalation through IdP claims | provider interface excludes roles/tenant; roles loaded from `identity.memberships` | compiled smoke injects fake platform role/tenant and receives local viewer only | productive group-to-membership provisioning policy absent |
| Browser use of service token | `/auth/*` rejects `Authorization`; service Bearer path unchanged | browser Authorization rejection and compatibility test | authenticated shell not implemented |
| Secret/PII leakage | digest/protected persistence, closed errors/reasons, no logging, minimized audit | audit serialization test, SQL audit inspection, static scans | operational logging/APM configuration not deployed |
| Fail-open configuration | disabled default; enablement requires explicit approval, adapter, origin, protector, repository; test components rejected in production | configuration tests and EVAL | deployment composition and secret delivery absent |
| Session table bypass | forced RLS; non-owner runtime; security-definer functions with fixed search path | disposable PostgreSQL gate | grants must be reproduced in deployment/IaC after approval |
| Unbounded storage | bounded transaction/code/session TTLs and opportunistic pre-tenant cleanup | migration checks | scheduled purge/retention SLO not implemented |
| Audit sink failure | login audit failure revokes new session; bounded generic error | code review | bootstrap/rotation audit failure compensation requires continued hardening |
| External IdP compromise/outage | no productive IdP selected; BFF disabled by default | configuration gate | provider selection, HA, incident response, key rollover and outage policy human-gated |

## Red-team conclusions

The foundation resists the requested local attack classes and does not create a productive authentication claim. The highest residual risks are productive OIDC validation, provider/tenant policy, concurrent rotation behavior, operational retention/purge, reverse-proxy origin handling, recovery/MFA, and authenticated UI authorization. These remain blockers, not accepted production risks.
