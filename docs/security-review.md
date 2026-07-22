# Security review — public GitHub Pages product

## Scope

This review covers:

- static Pages artifact generation;
- the fail-closed `pages-api-bridge.js`;
- widget source-link behavior;
- Pages deployment workflow boundaries;
- separation between the public frontend and authenticated tenant APIs.

This review does not claim to be a penetration test.

## Summary

GitHub Pages ships static public assets only. It does not contain backend code,
database credentials, integration Bearer tokens, environment files, document
bytes, embeddings, or static evidence responses. Without an explicitly
configured HTTPS backend, approved API calls return a bounded 503 and widget
query controls are disabled.

## Findings and mitigations

### API URL configuration

`PAGES_API_URL` is injected at build time through a non-secret GitHub variable.
The build rejects non-HTTPS production URLs, embedded credentials, query strings
and fragments. HTTP is accepted only for localhost. The runtime bridge strips
URL credentials defensively, omits fetch credentials, rejects redirects and
disables caching.

### No static municipal evidence

The previous static answer/procedure/domain bridge has been removed. Pages does
not manufacture responses, citations, procedures or authority states. The
widget no longer says that documents are official or verified without a real
backend response.

### Browser credential boundary

The authenticated v1 APIs require tenant-bound credentials. Those credentials
must never be embedded in Pages, JavaScript storage or browser requests. A
future public query gateway/BFF must bind an approved public corpus server-side
and enforce abuse controls without exposing a service credential.

### Source-link rendering

`pages-security-guard.js` removes unsafe source links. Allowed HTTP(S) links use
`target="_blank"` and `rel="noopener noreferrer"`. This client guard is defense
in depth; the backend must continue validating and minimizing source URLs.

### Security headers

GitHub Pages does not provide the complete environment-level header policy
needed for a final production deployment. A future public domain should use an
approved edge/load-balancer configuration for CSP, HSTS, frame policy,
Permissions-Policy, request limits and Cloud Armor or an equivalent WAF.

## Residual risks

- A future public API still needs rate limiting, exact CORS, abuse monitoring,
  minimized logging, edge controls and load evidence.
- The public gateway and human identity/session systems are not implemented.
- No real reviewed corpus is credited as ingested.
- GitHub repository variables, branch/environment protection and production
  headers require independent configuration evidence.

## Required next security work

1. Implement and red-team the dedicated public query gateway/BFF.
2. Bind it to one reviewed public corpus; accept no tenant or credential claim
   from the browser.
3. Deploy only through approved GCP workload identities and Secret Manager.
4. Exercise cross-tenant, abuse, timeout, provider-failure and no-evidence paths
   in staging.
5. Complete human accessibility, penetration testing and incident exercises
   before production approval.
