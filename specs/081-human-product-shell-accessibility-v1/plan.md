# Implementation plan

1. Remove unauthenticated product navigation from the accessibility tree.
2. Add deterministic checks for unique IDs, accessible names, target size, heading order, hidden-focus containment and visible current-page state.
3. Exercise the shell at a 320-pixel viewport and verify no document overflow.
4. Retain keyboard skip navigation and permission-aware denied-route checks.
5. Parameterize the existing deterministic BFF shell smoke across Chromium, Firefox and WebKit.
6. Add focused tests, named EVAL, CI wiring, product documentation, ADR, risk review, traceability and independent review.
7. Run full applicable regression, validation, audits and scans.
8. Persist exact evidence without claiming WCAG conformance, human accessibility acceptance or productive authenticated journeys.
