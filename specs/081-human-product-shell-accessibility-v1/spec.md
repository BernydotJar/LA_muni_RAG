# Feature 081 — Cross-browser automated accessibility complement v1

Status: local automated complement implemented; human accessibility acceptance and productive journeys remain absent

## Goal

Strengthen the Feature 078 role-aware shell with executable accessibility checks in Chromium, Firefox and WebKit without representing automation as WCAG conformance, screen-reader acceptance or a productive authenticated journey.

## Functional requirements

1. Product navigation is hidden from the visual and accessibility trees until a human BFF session is authenticated.
2. The shell retains Spanish language metadata, skip navigation, semantic header/aside/navigation/main regions, live status regions and keyboard-visible focus.
3. HTML IDs are unique and all `aria-labelledby` and fragment references resolve.
4. The browser harness audits both anonymous and authenticated states for duplicate IDs, unnamed visible interactive controls, visible focusables inside hidden containers, heading-level jumps and a single visible current-page marker.
5. Visible interactive targets are at least 24 by 24 CSS pixels, excluding the off-canvas skip link before focus.
6. A 320 by 900 viewport has no document-level horizontal overflow.
7. The keyboard can focus the skip link first.
8. The permission-aware browser checks still prove denied and malformed hash fallback, role-specific navigation, session rotation, logout, empty Web Storage and unreadable HttpOnly cookies.
9. The same deterministic shell smoke runs in Chromium, Firefox and WebKit.
10. Browser output states that automated accessibility checks ran and preserves the productive authenticated journey result at `0/12`.
11. CI installs all three browser engines and executes the cross-browser shell gate.
12. Documentation explicitly states that automated checks do not replace screen-reader, keyboard-only human, zoom/reflow, contrast, cognitive/usability or assistive-technology review.

## Acceptance criteria

- `npm run test:human-product-shell-accessibility` passes.
- `npm run smoke:human-product-shell-cross-browser` passes in Chromium, Firefox and WebKit.
- `EVAL-HUMAN-PRODUCT-SHELL-ACCESSIBILITY-001` passes.
- Existing BFF, shell, reliability, decision-packet and public-browser gates remain green.
- Typecheck, build, full regression, structured validation, dependency audit, secret/PII scan and diff checks pass.
- The official productive authenticated journey result remains `0/12`.

## Explicit limitations

- The checks do not calculate color contrast or assert a WCAG conformance level.
- No screen-reader engine, magnification software, switch input, voice control or real assistive-technology user is exercised.
- No productive IdP, real ephemeral environment, external municipal user or complete authenticated workflow is present.
- Deterministic cross-browser execution is local test evidence only.
- This feature is not production readiness.
