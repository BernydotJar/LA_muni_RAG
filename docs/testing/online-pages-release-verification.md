# Online Pages release verification

The release verifier proves that a public Pages URL serves one exact repository revision.

```bash
PAGES_BUILD_SHA="$(git rev-parse HEAD)" npm run build:pages
PAGES_BUILD_SHA="$(git rev-parse HEAD)" node scripts/verify-pages-artifact.mjs
PAGES_ONLINE_URL="https://example.github.io/project/" \
EXPECTED_BUILD_SHA="$(git rev-parse HEAD)" \
npm run verify:pages:online
```

The URL must use HTTPS except for `localhost`, `127.0.0.1`, or `::1`. Credentials, query
parameters, and fragments are rejected. The verifier checks desktop and mobile Chromium,
`build-metadata.json`, the HTML SHA marker, product navigation, favicon, focusable main target,
responsive width, widget/API configuration, browser errors, and failed network requests.

A successful loopback run proves the verifier and artifact contract. It is not a public deployment
receipt. A public receipt requires an authorized Pages deployment and a successful post-deployment
workflow on the exact deployed SHA.

## Deployment authorization record

Before dispatching `Deploy GitHub Pages` from a feature branch, record:

- exact 40-character source SHA;
- public start time and review window;
- whether the current public site may be replaced;
- rollback SHA/ref and rollback owner;
- whether `PAGES_API_URL` must remain unset and fail-closed;
- confirmation that no merge, Cloud SQL restart, Terraform action, or backend enablement is implied.
