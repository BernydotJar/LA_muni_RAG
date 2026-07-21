# Feature 063 — Academia de Procedimientos

Status: implemented and verified locally; detached/publication/remote CI pending

## Product objective

Create a beautiful, high-density, accessible public training preview that teaches
how to read and follow an evidence-backed municipal procedure. The first module
covers the 47 research categories for a community potable-water project in La
Antigua Guatemala.

The surface must answer, for each learning phase:

- what action is being investigated;
- who participates, only when evidence supports it;
- which documents and outputs are known;
- which decisions or dependencies exist;
- what evidence supports the phase;
- what remains unknown.

## Boundary

This feature is a public/read-only training preview, not the authenticated SaaS
application. It may store only local non-sensitive learning progress. It must not
store Bearer credentials, case facts, official completion, approval or legal
status in browser storage.

SaaS-only areas are visible as disabled navigation with an explanation that a
human session/tenant architecture is pending. Integration credentials are never
a browser login mechanism.

## Acceptance criteria

1. The page has a semantic app shell, skip link, Spanish labels and explicit
   public/read-only status.
2. The water module contains exactly 47 ordered, unique research categories and
   states that they are categories, not predetermined facts.
3. Categories are grouped into a small number of teachable phases without
   changing their sequence.
4. Procedure data is fetched safely with credentials omitted and redirects
   rejected; a static degraded curriculum remains usable when the API fails.
5. Dynamic data is rendered with DOM/textContent, not string HTML insertion.
6. Every lesson exposes action, participant status, documents, decisions,
   evidence status, citations or gaps, risks and unknowns.
7. Learning progress is explicitly “understood locally,” never “procedure
   completed,” and can be cleared.
8. Keyboard navigation supports ArrowUp/ArrowDown/Home/End across lessons.
9. Layout works at desktop, tablet and mobile widths; motion respects
   `prefers-reduced-motion` and forced-colors remains usable.
10. Core text/background tokens meet WCAG AA contrast in executable tests.
11. GitHub Pages build/verification includes the full training surface.
12. The page contains no credential/token storage, fake login or institutional
    certification claim.

## Remaining production gates

- approved OIDC/session/BFF and tenant provisioning architecture;
- authenticated role-aware shell;
- browser E2E across supported browsers/viewports;
- screen-reader testing and human WCAG review;
- procedure/case APIs and real-corpus evidence;
- telemetry, staging and deployment approval.
