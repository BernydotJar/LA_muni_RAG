# Current Progress

## Active Feature

none

## Last Completed Feature

037A-frontend-widget-contract-regression-fix

## State

done

## Mode

MVP

## Summary

Feature 037A is closed as a focused frontend/widget test-contract stabilization slice. It preserves Feature 036 Procedure Workflow Advisor logic and updates brittle frontend assertions so compact/minified static assets are accepted where the contract remains the same.

## Completed Implementation

037A added or updated:

- specs/037A-frontend-widget-contract-regression-fix/requirements.md
- specs/037A-frontend-widget-contract-regression-fix/design.md
- specs/037A-frontend-widget-contract-regression-fix/tasks.md
- src/__tests__/chat-answer-composition.test.ts
- src/__tests__/premium-chat-widget.test.ts
- src/__tests__/frontend-responsive-layout.test.ts
- src/__tests__/glass-wall-premium-refresh.test.ts

## Final Acceptance

- The widget `/api/chat` payload contract remains asserted.
- The default widget mode assertion now accepts compact or formatted syntax for `this.searchMode = "keyword"`.
- The civic hero asset assertion accepts the current SVG ring animation names while preserving the orbital/palace contract.
- The Glass Wall allowlist assertion still requires approved endpoints and a clear blocked-endpoint message.
- `src/procedure/*` was not modified.
- `dist-pages/` was not touched.

## Verification

Local verification was not run in this connector-only environment.

Run locally:

- npm run typecheck
- npm run build
- npm run test

## Next Recommended Feature

037-procedure-workflow-ui-cards
