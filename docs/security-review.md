# Final Security Review — GitHub Pages Demo

## Scope

This review covers the public demo surface introduced by the GitHub Pages deployment:

- static Pages artifact generation;
- `pages-demo-api.js` demo/API bridge;
- widget source-link behavior on Pages;
- Pages deployment workflow boundary;
- separation between static frontend and backend RAG runtime.

This review does not claim to be a penetration test.

## Summary

The Pages deployment is intentionally static-only. It does not ship backend code execution, database credentials, embeddings, environment files, or secrets. The demo now includes a defensive client-side bridge so the public site remains usable without a backend while preserving a path to route to a deployed API.

## Findings and Mitigations

### 1. API URL configuration hardening

Risk: `?apiUrl=` and `data-api-url` could be used with unsafe URL schemes or credential-bearing URLs.

Mitigation implemented:

- only `https:` API URLs are accepted for public use;
- `http:` is accepted only for localhost development;
- username, password, query, and hash are stripped;
- credentials are omitted from proxied fetches;
- redirects are rejected.

### 2. Source-link rendering hardening

Risk: a future API could return citation source URLs with unsafe schemes.

Mitigation implemented:

- added `pages-security-guard.js` for the Pages demo;
- unsafe rendered source links are converted to `Fuente no enlazada`;
- allowed links receive `target="_blank"` and `rel="noopener noreferrer"`.

### 3. GitHub Pages security header limitation

Risk: GitHub Pages does not provide project-level custom security headers in this static setup.

Mitigation:

- no secrets or backend runtime are shipped;
- demo responses are static and non-sensitive;
- production deployment should put the static site behind a CDN or reverse proxy if strict CSP, HSTS, X-Frame-Options, or Permissions-Policy headers are required.

## Residual Risks

- A future public API still needs rate limiting, auth policy, CORS origin policy, abuse monitoring, request logging, and deployment-specific security headers.
- The Pages demo is public and should not include confidential municipal documents.
- This repository still needs separate backend CI/security gates for dependency scanning and server-side hardening.

## Recommended Next Security Work

1. Add a backend CI workflow with typecheck, tests, dependency audit, and secret scanning.
2. Add production API deployment hardening before connecting Pages to a live `/api/chat`.
3. Add explicit CORS allowlist for production API origins.
4. Add rate limiting and request size monitoring on the deployed API.
5. Serve production behind a platform that supports security headers.
