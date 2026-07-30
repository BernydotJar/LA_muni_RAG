# Public procedure premium release verification

## Local gates

```bash
npm audit --audit-level=high
npm run graph-harness:verify
npm run typecheck
npm test
npm run build
PAGES_BUILD_SHA=<pre-merge-main-sha> node scripts/verify-pages-artifact.mjs
npm run test:browser:public
```

After browser tests, rebuild the configured artifact because the Playwright web server intentionally builds fail-closed Pages:

```bash
PAGES_API_URL=https://<cloud-run-service> \
PAGES_BUILD_SHA=<pre-merge-main-sha> \
npm run build:pages

PAGES_BUILD_SHA=<pre-merge-main-sha> \
node scripts/verify-pages-artifact.mjs
```

## Managed-database smoke

Use Cloud SQL Auth Proxy and the runtime database secret. Never print the secret or the full database URL.

Required assertions:

- `/health` advertises public procedure routes and lexical hybrid semantics;
- exact-origin domain metadata returns 200;
- the approved water query returns at least one HTTPS citation;
- the approved stadium query returns at least one HTTPS citation;
- unsupported steps remain `insufficient` and produce gaps;
- foreign origin is 403;
- Authorization and Cookie are rejected;
- repeated calls reach 429 under the configured test limit.

## Release order

1. Commit and push exact source plus complete versioned Pages artifact.
2. Require Backend CI and Public Browser Gate success for the exact head.
3. Build the container from `git archive` of that exact head and publish by digest.
4. Deploy a no-traffic Cloud Run revision, smoke it, then move traffic.
5. Merge only with the expected head SHA.
6. Verify both Pages workflows and the final browser end-to-end flow.
7. Record Graph Harness evidence and close the gate.
