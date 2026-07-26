# Feature 075 — Public browser gate v1

Status: implemented and verified locally in Chromium desktop and mobile; remote CI pending publication.

## Goal

Add a reproducible Playwright gate for the static public product surfaces without claiming
authenticated SaaS coverage. The gate must execute the built GitHub Pages artifact in a real
browser and verify responsive behavior, keyboard/focus semantics, reduced motion, fail-closed
API behavior, bounded local learning progress, and credential stripping in the Pages API bridge.

## Acceptance

- Playwright and its configuration are version-pinned in the locked Node dependency graph.
- Desktop Chromium and a mobile emulation execute the same public contracts.
- The homepage has no horizontal overflow, keeps the intended responsive layout, exposes a
  working skip link, and opens a disabled assistant when no backend is configured.
- Reduced-motion preference disables decorative and widget animation.
- Academia degrades to its static curriculum through the fail-closed Pages bridge and stores
  only the bounded learning-progress record.
- Procedure workflow reports an explicit HTTP 503 and remains usable when Pages has no backend.
- A configured bridge forwards only approved methods, strips browser credentials/cookies and
  custom headers, and preserves only the bounded request body and query parameters.
- Unexpected page errors and console errors fail the gate.
- GitHub Actions runs the browser gate independently from the backend and Terraform workflows.
- The repository explicitly preserves the twelve authenticated browser journeys as blocked.

## Non-goals

No human identity provider, BFF session, authenticated role-aware UI, real-corpus browser
journey, Cloud SQL restart, Terraform mutation, production deployment, merge, OS Electoral
implementation or Content Agency implementation.
