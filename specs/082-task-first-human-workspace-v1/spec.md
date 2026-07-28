# Feature 082 — Task-first human workspace v1

Status: implemented and locally verifiable; productive data workflows remain absent

## Goal

Replace the generic authenticated dashboard with a focused municipal evidence workspace while preserving the provider-neutral BFF, local membership authorization, accessibility complement and public-surface boundary.

## Functional requirements

1. The primary authenticated view starts from municipal evidence work, not role, permission or module counts.
2. Navigation is grouped into work, corpus and governance domains.
3. Technical session identifiers and counts remain available in a secondary disclosure rather than leading the product.
4. Canonical same-origin deep links cover search, research, procedures, cases, corpus, workflows, identity, audit, platform, accessibility and tenant-boundary journey entry points.
5. Every deep link returns the same protected, no-store shell and rejects mutation methods.
6. Path-to-panel mapping uses closed allowlists. Unknown, malformed and unauthorized routes fall back to overview without reflecting attacker-controlled text.
7. Task shortcuts are permission-bound using the same local effective-permission contract as navigation.
8. Empty states state the true readiness boundary: no real corpus, no productive IdP and zero productive authenticated journeys.
9. The shell does not fabricate municipal records, sample results or a working search form.
10. Visual styling uses a restrained civic editorial system without gradients, glass effects or decorative metric cards.
11. Existing CSRF, same-origin credential, HttpOnly cookie, no-Bearer, no-Web-Storage and CSP controls remain unchanged.
12. Reflow diagnostics identify overflowing elements and the authenticated workspace remains bounded at 320 CSS pixels.
13. Deterministic Chromium, Firefox and WebKit checks exercise task navigation and canonical deep-link authorization.
14. Feature 079 telemetry contracts and transient provider-outage semantics compile and pass their named EVAL.
15. Login preserves an exact allowlisted deep-link return path; open redirects, query strings and fragments remain rejected.
16. User navigation pushes browser history while bootstrap, malformed and denied-route normalization replace the current entry.
17. Denial feedback uses warning styling, clears after valid navigation and never reflects the requested token.
18. Provider adapters classify ordinary authentication rejection separately from transient unavailability without exposing diagnostics.

## Acceptance criteria

- Focused Feature 082 tests pass.
- EVAL-HUMAN-WORKSPACE-001 passes.
- Existing BFF, shell, accessibility and reliability focused gates pass.
- Chromium, Firefox and WebKit shell smoke passes.
- Browser smoke proves deep-link return plus Back/Forward behavior for both tested roles.
- Typecheck, build, full regression, structured validation, dependency audit, secret/PII scan and diff checks pass.
- Program records distinguish local deterministic shell evidence from productive browser journeys.
- Productive authenticated journeys remain 0/12.

## Explicit limitations

- No real municipal corpus or productive search result is present.
- No productive IdP, external municipal user or managed ephemeral browser environment is present.
- Module panels are honest route and readiness foundations, not complete browser-to-domain BFF workflows.
- Automated accessibility remains complementary and is not WCAG conformance or human assistive-technology acceptance.
- This feature is not production readiness.

