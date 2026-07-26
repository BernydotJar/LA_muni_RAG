# Decision 075 — Establish a real-browser gate for public Pages surfaces

## Decision

Use Playwright with pinned Chromium execution to test the generated GitHub Pages artifact in
both desktop and mobile modes. Keep this gate separate from the authenticated browser journey
matrix.

The gate uses a loopback-only static server and a test-only echo harness. It exercises the real
Pages bridge, public UI JavaScript and widget shadow DOM. It fails on unexpected browser errors
and retains diagnostics only on failure.

## Rationale

Static source assertions detect missing strings but do not prove browser focus, responsive
geometry, shadow-DOM behavior, localStorage boundaries or network credential stripping. A real
browser gate closes those gaps without inventing an identity system or counting public pages as
authenticated SaaS journeys.

## Consequences

Public Pages regressions become a required CI check. Browser installation adds CI time and a
small dependency surface. The twelve authenticated journeys remain blocked and must not be
reported as passed until human identity, session exchange and role-aware UI exist and are tested.
