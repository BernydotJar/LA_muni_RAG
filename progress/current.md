# Current Progress

## Active Feature

none

## Last Completed Feature

038-procedure-workflow-widget-entrypoint

## State

done

## Mode

MVP

## Summary

Feature 038 is closed as an MVP. LA Muni RAG now has a lightweight widget entrypoint into the Procedure Workflow UI and an AI-native operating-model note derived from the attached transcript.

## Baseline

Before this feature, the user reported local verification green:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 246 passed, 0 failed

`dist-pages/` remained untracked and out of scope.

## Completed Implementation

038 added or updated:

- specs/038-procedure-workflow-widget-entrypoint/requirements.md
- specs/038-procedure-workflow-widget-entrypoint/design.md
- specs/038-procedure-workflow-widget-entrypoint/tasks.md
- public/procedure-widget-entrypoint.js
- scripts/build-pages.mjs
- scripts/verify-pages-artifact.mjs
- docs/ai-native-operating-model.md
- docs/procedure-workflow-widget-entrypoint.md
- src/__tests__/procedure-workflow-widget-entrypoint.test.ts

## Final Acceptance

- Added a separate widget enhancement script: `public/procedure-widget-entrypoint.js`.
- `public/widget.js` was not modified.
- The script adds a `Flujos` rail pill and a `Generar flujo procedimental paso a paso` welcome suggestion when the widget Shadow DOM is available.
- Default target is `./procedure-workflow.html`; it is configurable with `data-procedure-url`.
- The script avoids duplicate entrypoints and stops after bounded observation.
- GitHub Pages build injects the entrypoint after `widget.js`.
- GitHub Pages artifact verification requires `procedure-widget-entrypoint.js`.
- Added AI-native operating model documentation from the attached transcript.
- `src/procedure/*` backend logic was not modified.
- `dist-pages/` was not touched.

## Verification

Local verification was not run in this connector-only environment.

Run locally:

- npm run typecheck
- npm run build
- npm run test

## Next Recommended Feature

039-procedure-workflow-feedback-loop
