# Current Progress

## Active Feature

050-procedure-deep-dive-ui

## Last Completed Feature

049-procedure-workflow-advisor-deep-dive

## State

review

## Mode

MVP

## Summary

Feature 050 connects the verified Procedure Workflow Advisor deep-dive contract to the existing public workflow page through an isolated progressive-enhancement layer. Overview remains the default. Deep dive adds dependencies, per-step evidence status, evidence statements, supported responsibility/deadline metadata, expandable citations, and visible unsupported/inferred states.

## Completed Implementation

- Created `feature/050-procedure-deep-dive-ui` from verified commit `0fc42a8`.
- Added overview / `Ver flujo completo` depth control.
- Added `depth=overview|deep_dive` to procedure requests without changing the existing page renderer.
- Added step evidence badges and explicit insufficiency/inference statements.
- Added dependency rendering.
- Added responsible role, unit, and deadline fields only when returned by the API.
- Added escaped expandable citation dossiers.
- Added conservative GitHub Pages demo promotion for deep-dive requests.
- Added focused static tests, Pages artifact verification, documentation, issue #8, and harness tracking.
- Preserved backend procedure semantics, corpus, migrations, War Room work, and deployment configuration.

## Verification Status

Remote implementation and static inspection are complete. Local verification remains required:

- `npm run typecheck`
- `npm run build`
- focused UI tests
- complete test suite
- `npm run build:pages`
- `node scripts/verify-pages-artifact.mjs`
- `git diff --check`
- clean `git status --short` after scoped Pages cleanup

## Next Work

Run the local gate, correct resolvable defects, then perform Reviewer validation. Do not merge or deploy automatically.
