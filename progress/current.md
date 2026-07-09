# Current Progress

## Active Feature

038-procedure-workflow-widget-entrypoint

## State

review

## Mode

MVP

## Summary

Feature 038 adds a lightweight entrypoint from the existing chat widget surface into the Procedure Workflow UI. It also integrates the attached AI-native transcript as product operating-model documentation for how this RAG should evolve: capture signal, govern access, expose safe APIs, optimize an outcome object, and use feedback loops.

## Baseline

Before this feature, the user reported local verification green:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 246 passed, 0 failed

`dist-pages/` remains untracked and out of scope.

## Acceptance Focus

- Add `public/procedure-widget-entrypoint.js` as a separate widget enhancement script.
- Do not modify `public/widget.js` directly.
- Add a visible procedure workflow entrypoint inside the widget Shadow DOM when available.
- Default target: `/procedure-workflow.html`, configurable by `data-procedure-url`.
- Avoid duplicates and stop observer/timer after bounded attempts.
- Update Pages build/verify scripts for the entrypoint.
- Add AI-native operating model documentation from the attached transcript.
- Do not modify `src/procedure/*` backend logic.
- Do not touch `dist-pages/`.

## Verification Required

Run locally:

- npm run typecheck
- npm run build
- npm run test
