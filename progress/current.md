# Current Progress

## Active Feature

040-procedure-feedback-review-dashboard

## State

review

## Mode

MVP

## Summary

Feature 040 adds a local review dashboard for ProcedureWorkflow feedback captured by Feature 039. The dashboard reads localStorage feedback, renders metrics and feedback cards, supports filtering, and lets the team copy/export JSON without backend persistence.

## Baseline

Before this feature, Feature 039 was closed as a local/exportable feedback loop.

`dist-pages/` remains untracked and out of scope.

## Acceptance Focus

- Add `public/procedure-feedback-dashboard.html`.
- Read only from `la-muni-rag:procedure-feedback`.
- Render metrics, filters, and feedback review cards.
- Support copy/export filtered and full JSON.
- Support clearing local feedback with confirmation.
- Link the dashboard from `procedure-workflow.html`.
- Update Pages build/verify scripts for the dashboard page.
- Document local-only governance and future backend path.
- Do not modify `src/procedure/*` backend logic.
- Do not touch `dist-pages/`.

## Verification Required

Run locally:

- npm run typecheck
- npm run build
- npm run test
