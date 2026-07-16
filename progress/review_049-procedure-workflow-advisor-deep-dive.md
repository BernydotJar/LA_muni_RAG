# Review — 049 Procedure Workflow Advisor Deep Dive

## Status

Done after local verification.

## Review Summary

Feature 049 adds `depth=deep_dive` to the Procedure Workflow Advisor while preserving `overview` as the default. Deep-dive responses expose step-level evidence status, explicit evidence statements, dependencies, strict step citation matching, and comparative-source governance.

## Fixes Applied During Local Review

- Restored `createApiServer(options)` in `src/server.ts` as a compatibility wrapper around `createServer(createRequestHandler(options))`.
- Added HTTP integration coverage for:
  - `GET /api/procedure?...&depth=deep_dive`
  - `GET /api/procedure?...&depth=bad` returning `invalid_depth`

## Verification

Ran locally:

- `npm run typecheck`: passed
- `npm run build`: passed
- focused tests:
  - `src/__tests__/procedure-workflow-deep-dive.test.ts`
  - `src/__tests__/server.test.ts`
- `npm run domain:evaluate`: passed, 6/6 cases
- `npm run test`: 327 passed, 0 failed
- `npm run build:pages`: passed
- `node scripts/verify-pages-artifact.mjs`: passed
- `git diff --check`: passed

Generated `dist-pages/` output was cleaned after verification.

## Residual Notes

This remains a stacked branch over `feature/048-template-bootstrap-cli`. A PR to `main` would include earlier feature work; use a stacked PR base until 048 is integrated.
