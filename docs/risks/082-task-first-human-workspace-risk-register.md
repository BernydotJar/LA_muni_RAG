# Feature 082 risk and threat review

Date: 2026-07-28
Scope: authenticated workspace presentation, path routing and inherited reliability repair

| Risk / failure | Control implemented | Verification | Residual risk / next gate |
|---|---|---|---|
| Generic dashboard obscures the primary job | task-first evidence workspace; technical counts moved to disclosure | source test and named EVAL | usability review with municipal users absent |
| Deep-link journey path returns 404 | exact server-side path allowlist | HTTP test across every declared path | productive ingress and IdP redirect behavior absent |
| Login loses the requested deep link | API server composes exact return allowlist; shell derives encoded `return_to` from a closed path map | viewer/admin callback smoke begins at `/app/search` | productive IdP interoperability remains absent |
| Open redirect enters the login transaction | return paths forbid external, query and fragment values and require exact membership | BFF validation and source EVAL | future parameterized routes need a separate canonicalization design |
| Browser history is destroyed | deliberate clicks use pushState; bootstrap and safe normalization use replaceState | Back/Forward cross-browser smoke | multi-tab workflow UX remains unreviewed |
| Denial or focus feedback is misleading | warning-specific alert that clears on valid navigation; focus pairs exceed 3:1 | focused contrast and cross-browser checks | human forced-colors and low-vision acceptance absent |
| Route value enables selector injection | static path and panel maps; array find on exact route token | malformed and source-injection tests | future parameterized routes require separate validation |
| Unauthorized deep link reveals a panel | candidate must be visible and permission-granted; fixed overview fallback | viewer/admin browser smoke | complete cross-tenant workflow data absent |
| Attacker path is reflected into the page | fixed denial message; no requested value assigned to text | source assertions | future error localization must preserve non-reflection |
| UI fabricates readiness or municipal results | explicit zero-corpus, no-IdP and 0/12 states; no search form | Feature 082 tests | real corpus and workflows still blocked |
| Visual refresh weakens browser security | lifecycle JS and CSP boundary retained | existing Feature 077/078 gates | productive edge policy absent |
| Narrow authenticated view overflows | minmax zero grid tracks and element-level diagnostics | 320 px cross-browser gate | human zoom and magnifier acceptance absent |
| Reference implementation is copied without fit review | only task-first principles recorded; no code/assets/dependencies imported | diff review and ADR | future design work needs ownership review |
| Reliability commit cannot compile | missing telemetry types/options restored | typecheck and Feature 079 EVAL | productive exporter remains absent |
| Provider outage misclassified as denial | unexpected exchange outage returns generic 503 and clears transient state | failure-injection test | productive provider retry UX and operations absent |
| Local shell is mistaken for production completion | empty states and records retain 0/12/productive blockers | named EVAL and program gate | human IdP, corpus, staging and release gates remain open |

## Review conclusion

The increment removes generic dashboard patterns and creates a safer journey-shaped shell. It does not create productive data workflows or establish production readiness.

