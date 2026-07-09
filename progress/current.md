# Current Progress

## Active Feature

none

## Last Completed Feature

037-procedure-workflow-ui-cards

## State

done

## Mode

MVP

## Summary

Feature 037 is closed as an MVP. LA Muni RAG now has a dedicated Procedure Workflow UI page that calls `/api/procedure` and renders the response as workflow cards with steps, required documents, output documents, evidence chips, gaps, confidence, external-reference warning, and human validation warning.

## Baseline

Before this feature, the user reported local verification green after frontend contract fixes:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 246 passed, 0 failed

`dist-pages/` remained untracked and out of scope.

## Completed Implementation

037 added or updated:

- specs/037-procedure-workflow-ui-cards/requirements.md
- specs/037-procedure-workflow-ui-cards/design.md
- specs/037-procedure-workflow-ui-cards/tasks.md
- public/procedure-workflow.html
- public/pages-demo-api.js
- scripts/build-pages.mjs
- scripts/verify-pages-artifact.mjs
- src/__tests__/procedure-workflow-ui-cards.test.ts
- docs/procedure-workflow-ui-cards.md

## Final Acceptance

- Added a Spanish procedure workflow UI at `/procedure-workflow.html`.
- The page calls `/api/procedure` with query, mode, and limit.
- The UI renders summary, step cards, required documents, output documents, citations, gaps, validation warning, and copy-checklist affordance.
- The UI escapes dynamic text before rendering.
- GitHub Pages demo mode supports `/api/procedure` through `pages-demo-api.js`.
- Pages artifact build/verification now includes `procedure-workflow.html`.
- `src/procedure/*` backend logic was not modified.
- `dist-pages/` was not touched.

## Verification

Local verification was not run in this connector-only environment.

Run locally:

- npm run typecheck
- npm run build
- npm run test

## Next Recommended Feature

038-procedure-workflow-widget-entrypoint
