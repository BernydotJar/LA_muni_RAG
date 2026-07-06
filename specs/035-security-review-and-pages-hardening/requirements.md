# Feature 035 — Security Review and Pages Hardening

## Objective

Perform a final defensive security review of the GitHub Pages deployment, widget demo bridge, source-link behavior, and deployment boundaries before closing the public demo work.

## Requirements

1. Review the public attack surface introduced by GitHub Pages.
2. Harden `pages-demo-api.js` so configured API URLs are sanitized.
3. Reject non-http(s) API schemes.
4. Reject plain HTTP API URLs except localhost development.
5. Strip username, password, query, and hash from configured API base URLs.
6. Do not forward cookies or credentials through the Pages API bridge.
7. Do not follow redirects when proxying `/api/chat` through the client bridge.
8. Keep static demo citations without source links.
9. Add a Pages security guard that sanitizes rendered widget source links inside the Shadow DOM.
10. Require the security guard in the Pages artifact verifier.
11. Document accepted residual risks and operational recommendations.

## Non-goals

- No penetration test claim.
- No backend auth implementation.
- No CSP header implementation, because GitHub Pages static hosting does not allow custom security headers.
- No PDF viewer.
- No production API deployment.
