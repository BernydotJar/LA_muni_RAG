# Current Progress

## Active Feature

037-procedure-workflow-ui-cards

## State

review

## Mode

MVP

## Summary

Feature 037 adds a dedicated frontend page for Procedure Workflow Advisor responses. It renders `/api/procedure` output as workflow cards with steps, documents, evidence, gaps, confidence, and validation warning.

## Baseline

Before this feature, the user reported local verification green after frontend contract fixes:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 246 passed, 0 failed

`dist-pages/` remains untracked and out of scope.

## Acceptance Focus

- Add a Spanish procedure workflow UI.
- Call `/api/procedure` with query, mode, and limit.
- Render summary, step cards, required documents, output documents, citations, gaps, and validation warning.
- Include copy-checklist affordance.
- Support GitHub Pages static demo mode for `/api/procedure`.
- Do not modify `src/procedure/*` backend logic.
- Do not touch `dist-pages/`.

## Verification Required

Run locally:

- npm run typecheck
- npm run build
- npm run test
