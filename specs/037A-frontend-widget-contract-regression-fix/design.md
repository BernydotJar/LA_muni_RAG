# Design — Frontend Widget Contract Regression Fix

## Problem

Feature 036 passed typecheck/build and its focused tests, but the full test suite still fails because several frontend/widget tests use strict textual expectations that no longer match the compact static assets.

The failing areas are existing frontend contracts, not Procedure Workflow Advisor behavior.

## Approach

Treat this as a test-contract stabilization slice:

1. Keep product logic unchanged unless a static asset has a genuinely missing contract marker.
2. Replace formatting-sensitive regex checks with semantic regex checks.
3. Preserve the same contractual assertions:
   - chat API payload includes `mode: this.searchMode`;
   - widget default mode is keyword;
   - phrase mode is available;
   - civic hero asset remains institutional and animated;
   - Glass Wall only renders allowlisted endpoints;
   - source links remain honest and do not invent fake PDFs.

## Files

Expected updates:

- `src/__tests__/chat-answer-composition.test.ts`
- `src/__tests__/premium-chat-widget.test.ts`
- `src/__tests__/frontend-responsive-layout.test.ts`
- `src/__tests__/glass-wall-premium-refresh.test.ts`

No backend procedure files should change.

## Verification

Run locally:

```bash
npm run typecheck
npm run build
npm run test
```

The connector environment cannot run local tests, so final closure must report verification as not run unless the user provides local results.
