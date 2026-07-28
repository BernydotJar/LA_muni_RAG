# Feature 082 independent implementation review

Date: 2026-07-28
Disposition: follow-up independent gate **PASS WITH LIMITATIONS**; not production ready

## Producer critique

1. The original overview led with role, permission and module counts instead of a municipal task.
2. Thirteen flat navigation buttons had no information hierarchy.
3. Planned journey URLs were not server routes and returned 404.
4. Module copy could be mistaken for implemented workflow capability.
5. The first responsive revision expanded the authenticated grid to 649 px at a 320 px viewport.
6. Feature 079 had committed tests and implementation references but omitted telemetry interfaces from the public type contract.
7. Unexpected provider exchange failures were returned as authentication denials despite the Feature 079 recovery contract requiring a generic server error.

## Independent critic gate 1

The independent red-team gate did not pass the first Feature 082 candidate. It found:

1. `/app/login` was the only planned journey entry point still returning 404;
2. deep links were lost because login always returned to `/app`;
3. `program/*` stopped at Feature 077;
4. provider exchange errors did not distinguish authentication rejection from transient unavailability;
5. the light-surface focus color was below the 3:1 non-text contrast threshold;
6. denied navigation used success styling and persisted after valid navigation;
7. the Feature 079 risk table contained a duplicated, malformed row;
8. this review declared pass before the independent gate had passed;
9. user navigation replaced browser history instead of preserving Back/Forward;
10. the favicon still used the discarded dark/teal identity.

## Fixes applied for follow-up verification

- evidence-first overview, grouped navigation and secondary session disclosure;
- explicit zero-data and non-productive empty states;
- exact protected deep-link allowlist and closed client route maps;
- permission checks for both navigation and task shortcuts;
- fixed non-reflective denial message;
- zero-minimum responsive tracks plus element-level overflow diagnostics;
- restored closed telemetry interfaces and dependency options;
- generic unavailable response, cookie clearing and fresh-login semantics for transient provider outages;
- deterministic browser checks retain rotation, logout, malformed route, storage, cookie and accessibility assertions.
- protected `/app/login` and server-composed deep-link return allowlist;
- dynamic `return_to`, retained deep-link after callback, and Back/Forward browser checks;
- closed provider error taxonomy: ordinary rejection is a generic 401, transient outage a generic 503;
- focus colors with deterministic contrast checks for light and sidebar surfaces;
- warning-specific denial styling that clears on valid navigation;
- repaired Feature 079 risk row and a civic light favicon.

## Follow-up verifier result

All ten initial red-team findings are closed in the local deterministic scope:

- Feature 082 focused workspace: 6/6 passed;
- `EVAL-HUMAN-WORKSPACE-001`: 8/8 passed;
- Feature 077 BFF: 20/20 and named EVAL 9/9 passed;
- Feature 079 reliability: 5/5 and named EVAL 9/9 passed;
- Feature 081 accessibility: 6/6 and named EVAL 9/9 passed;
- public browser gate: 10/10 passed;
- Chromium, Firefox and WebKit passed viewer/admin deep-link return, denied-route normalization, Back/Forward, rotation, logout, storage/cookie and accessibility assertions;
- full regression: 978 total, 976 passed, 0 failed and 2 explicit environment skips;
- PostgreSQL 15.18 with pgvector 0.8.5 passed migrations, non-owner forced-RLS runtime gate and compiled BFF smoke;
- contracts, consumer kits, staging plan, source inventory, decision packets and canonical workflow template validated;
- typecheck, build, dependency audits, structural validation, secret/PII review and `git diff --check` passed.

The verifier accepts Feature 082 as a local provider-neutral product foundation. The result does not convert the deterministic provider into a productive identity system and does not count any of the twelve productive authenticated journeys.

## Residual blockers

No productive IdP, real corpus, complete browser-to-domain BFF workflow, managed staging receipt, human accessibility acceptance or production operating model exists. Productive browser journeys remain 0/12.

