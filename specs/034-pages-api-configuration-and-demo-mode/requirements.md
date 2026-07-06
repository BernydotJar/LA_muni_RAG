# Feature 034 — Pages API Configuration and Demo Mode

## Objective

Make the GitHub Pages deployment presentable even when no backend API is deployed, while preserving a clean path to route the widget to a real API when one becomes available.

## Requirements

1. GitHub Pages must not show a broken chat experience when `/api/chat` is unavailable.
2. Add a static demo/API bridge for Pages.
3. The bridge must return static municipal evidence responses only in demo mode.
4. Demo mode must activate automatically on `*.github.io` when no API URL is configured.
5. The bridge must support `?apiUrl=https://...` for routing `/api/chat` requests to a deployed API.
6. The bridge must support a `data-api-url` attribute for explicit API configuration.
7. The bridge must be disabled with `data-demo-mode="false"`.
8. The Pages build must inject the bridge before `widget.js`.
9. The Pages artifact verifier must require the bridge file and injected script tag.
10. The bridge must not invent PDF/source links. Demo citations should remain `sourceUrl: null` unless real links are configured.

## Non-goals

- No backend deployment.
- No fake production API.
- No PDF viewer.
- No database or embedding changes.
- No changes to retrieval ranking or answer generation.
