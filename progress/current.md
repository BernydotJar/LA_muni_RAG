# Current Progress

## Active Feature

052-case-portfolio-dashboard — official-source attribution follow-up

## Last Completed Feature

051-procedure-case-workspace

## State

review

## Mode

MVP

## Summary

Feature 052 added a browser-local Case Portfolio Dashboard and was merged through PR #13. A post-merge review identified that procedure steps still displayed a generic `Requiere validación contra fuente oficial de Antigua Guatemala` note even when the RAG had already retrieved a classified official source. The active follow-up replaces that generic warning with structured per-step source attribution.

## Merged Dashboard

- PR #13 merged.
- Merge commit: `8305d9daf331fcb17432f827794921650e44e675`.
- The portfolio shell truncation found during visual review was corrected before merge.
- Browser review confirmed that the dashboard renders after the correction.

## Official Source Attribution Follow-up

- Added `authorityLabel` and `authorityLevel` to procedure citations.
- Added structured `sourceAttribution` to procedure steps.
- Distinguished official municipal sources, national legal bases, comparative references, contextual sources, and insufficient evidence.
- Changed step evidence status to depend on citations matched to that step rather than a workflow-global local-evidence flag.
- Removed the generic Antigua official-source warning when a classified source is already available.
- Added an overview/deep-dive visual attribution panel with source name, authority class, page, excerpt, and safe HTTP(S) link.
- Preserved comparative-source and national-versus-local governance boundaries.
- Added focused attribution tests, documentation, and Pages artifact verification.

## Verification Status

Remote implementation and static inspection are complete. Local verification remains required:

- `npm run typecheck`
- `npm run build`
- focused source-attribution and procedure tests
- `npm run domain:evaluate`
- complete test suite
- `npm run build:pages`
- `node scripts/verify-pages-artifact.mjs`
- `git diff --check`
- browser review in overview and deep-dive modes
- clean `git status --short` after scoped Pages cleanup

## Next Work

Run the local gate, visually confirm the five attribution states, then complete Reviewer validation. Do not merge automatically.