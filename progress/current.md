# Current Progress

## Active Feature

none

## Last Completed Feature

035-security-review-and-pages-hardening

## State

done

## Summary

Feature 035 is closed. A final defensive security review was completed for the GitHub Pages deployment, Pages demo/API bridge, widget source-link behavior, artifact generation, and static/backend boundary. The review hardened configurable API routing, added a Pages source-link security guard, extended artifact verification, and documented residual risks.

## Completed Implementation

035 added or updated:

- public/pages-demo-api.js
- public/pages-security-guard.js
- scripts/build-pages.mjs
- scripts/verify-pages-artifact.mjs
- src/__tests__/pages-api-demo-mode.test.ts
- src/__tests__/security-review-pages-hardening.test.ts
- docs/security-review.md
- specs/035-security-review-and-pages-hardening/requirements.md
- specs/035-security-review-and-pages-hardening/design.md
- specs/035-security-review-and-pages-hardening/tasks.md

## Final Acceptance

- `?apiUrl=` and `data-api-url` are sanitized before proxy mode is enabled.
- Only `https:` API URLs are accepted publicly; `http:` is limited to localhost development.
- Username, password, query, and hash are stripped from configured API base URLs.
- The Pages bridge omits credentials and rejects redirects when forwarding `/api/chat`.
- Static demo citations keep `sourceUrl: null` and do not invent PDF/source links.
- Pages includes a source-link security guard for rendered widget citation links.
- Unsafe rendered source links are converted to `Fuente no enlazada`.
- Safe source links receive `target="_blank"` and `rel="noopener noreferrer"`.
- Pages artifact verification requires the bridge and security guard.
- Findings, mitigations, and residual risks are documented in `docs/security-review.md`.

## Closing Notes

This was a defensive code review and hardening pass, not a formal penetration test.

Local verification commands:

- node scripts/build-pages.mjs
- node scripts/verify-pages-artifact.mjs
- npm run test

Recommended future security work before a production public API:

- dependency audit workflow;
- secret scanning workflow;
- API rate limiting;
- production CORS allowlist;
- request logging and abuse monitoring;
- platform/CDN security headers.

## Next Recommended Feature

none
