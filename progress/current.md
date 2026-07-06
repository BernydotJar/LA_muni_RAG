# Current Progress

## Active Feature

none

## Last Completed Feature

034-pages-api-configuration-and-demo-mode

## State

done

## Summary

Feature 034 is closed. GitHub Pages now has a static demo/API bridge so the public frontend remains usable even when no backend API is deployed. The Pages artifact injects `pages-demo-api.js` before `widget.js`; on `*.github.io` without an API URL, the bridge returns static municipal evidence responses. When a deployed API exists, the same frontend can route `/api/chat` through `?apiUrl=https://...` or `data-api-url` on the bridge script.

## Completed Implementation

034 added or updated:

- public/pages-demo-api.js
- scripts/build-pages.mjs
- scripts/verify-pages-artifact.mjs
- src/__tests__/pages-api-demo-mode.test.ts
- specs/034-pages-api-configuration-and-demo-mode/requirements.md
- specs/034-pages-api-configuration-and-demo-mode/design.md
- specs/034-pages-api-configuration-and-demo-mode/tasks.md

## Final Acceptance

- GitHub Pages no longer depends on a live `/api/chat` backend for demo usability.
- The bridge intercepts only `/api/chat` requests.
- Auto demo mode activates on `*.github.io` when no API URL is configured.
- `?apiUrl=https://...` routes chat requests to a deployed API.
- `data-api-url` also supports explicit API routing.
- `data-demo-mode="false"` disables the bridge.
- Demo citations keep `sourceUrl: null` and do not invent PDF/source links.
- Pages build injects the bridge before `widget.js`.
- Pages artifact verification requires the bridge file and injected script tag.
- No backend, database, embedding, ranking, or answer-generation behavior was changed.

## Closing Notes

Local Pages verification commands:

- node scripts/build-pages.mjs
- node scripts/verify-pages-artifact.mjs

Optional API demo URL format:

- https://bernydotjar.github.io/LA_muni_RAG/?apiUrl=https://your-api.example.com

Repository health checks remain recommended separately:

- npm run typecheck
- npm run build
- npm run test

## Next Recommended Feature

035-public-api-deployment-target
