# Current Progress

## Active Feature

039-procedure-workflow-feedback-loop

## State

review

## Mode

MVP

## Summary

Feature 039 adds a local/exportable feedback loop around the `ProcedureWorkflow` outcome object. The goal is to capture user signal about missing documents, unclear steps, missing legal basis, missing deadlines, or case evidence gaps without adding backend persistence yet.

## Baseline

Before this feature, the user reported local verification green before Feature 038:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 246 passed, 0 failed

`dist-pages/` remains untracked and out of scope.

## Acceptance Focus

- Add a feedback module for `procedure-workflow.html`.
- Dispatch a `procedure-workflow:rendered` event after workflow rendering.
- Store feedback locally under a namespaced `localStorage` key.
- Capture workflow metadata, selected step, feedback type, and free-text comment.
- Provide copy/export JSON action.
- Do not send feedback over the network in this MVP.
- Update Pages build/verify scripts for the feedback script.
- Document the AI-native feedback-loop pattern.
- Do not modify `src/procedure/*` backend logic.
- Do not touch `dist-pages/`.

## Verification Required

Run locally:

- npm run typecheck
- npm run build
- npm run test
