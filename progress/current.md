# Current Progress

## Active Feature

037A-frontend-widget-contract-regression-fix

## State

review

## Mode

MVP

## Summary

Feature 037A stabilizes existing frontend/widget regression tests before starting procedure workflow UI cards. The goal is to make the full `npm run test` suite green without changing Feature 036 Procedure Workflow Advisor logic.

## Acceptance Focus

- Preserve `/api/chat` widget contract and mode controls.
- Allow compact or formatted static JavaScript syntax in assertions.
- Preserve civic hero/palace asset checks while accepting current SVG animation names.
- Preserve Glass Wall endpoint allowlist and blocked-endpoint safety behavior.
- Do not touch untracked `dist-pages/` artifacts.
- Do not modify `src/procedure/*`.

## Verification Required

Run locally:

- npm run typecheck
- npm run build
- npm run test
