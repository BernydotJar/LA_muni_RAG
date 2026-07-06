# Design — Security Review and Pages Hardening

## Reviewed Surfaces

- GitHub Pages artifact generation.
- `pages-demo-api.js` fetch interception and demo responses.
- Widget source-link rendering.
- Static file deployment boundary.
- Backend API boundary as seen from Pages.

## Main Findings

### Finding 1 — API URL configuration needed sanitization

`?apiUrl=` and `data-api-url` are useful for demo routing, but should not accept arbitrary schemes or credential-bearing URLs.

Mitigation:

- parse configured API base URLs with `URL`;
- allow only `https:` and local-development `http:`;
- strip username, password, search, and hash;
- omit credentials when forwarding;
- reject redirects.

### Finding 2 — Citation source links need defensive treatment

When a real API is connected, citations may include `sourceUrl`. The widget escapes HTML text, but link URLs still need scheme-level treatment.

Mitigation:

- add a Pages source-link security guard;
- permit only `http:` and `https:` rendered source links;
- remove unsafe hrefs;
- add `target="_blank"` with `rel="noopener noreferrer"` on allowed links.

### Finding 3 — GitHub Pages cannot provide custom security headers

GitHub Pages static hosting does not support project-specific security headers in this setup.

Mitigation:

- keep secrets and backend runtime out of Pages;
- avoid shipping environment files;
- keep demo data static and non-sensitive;
- recommend adding headers at a CDN/reverse proxy if this becomes a production public endpoint.

## Residual Risk

This is a defensive code review and hardening pass, not a formal penetration test. A future production API deployment still needs authentication policy, rate limiting, CORS origin policy, request logging, abuse monitoring, and deployment-specific security headers.
