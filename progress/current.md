# Current Progress

## Active Feature

041-procedure-feedback-backend-api

## State

review

## Mode

MVP

## Summary

Feature 041 adds a secure PostgreSQL-backed API for ProcedureWorkflow feedback. The API is authenticated with a configured Bearer token, validates and normalizes payloads, rate-limits writes, stores no request metadata, and preserves `external reference` governance.

## Verified Baseline

Before this feature, the user reported:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 270 passed, 0 failed
- npm run build:pages && node scripts/verify-pages-artifact.mjs: passed

Generated `dist-pages/` was cleaned and remains out of scope.

## Acceptance Focus

- Add `db/migrations/002_procedure_feedback.sql`.
- Add authenticated POST and GET `/api/procedure-feedback` routes.
- Fail closed when `PROCEDURE_FEEDBACK_API_TOKEN` is absent.
- Strictly validate values and field lengths.
- Use parameterized SQL and 180-day retention metadata.
- Rate-limit POST requests without persisting IP addresses.
- Do not expose or embed the token in public frontend assets.
- Keep feedback as product signal, not municipal evidence.
- Preserve explicit `external reference` classification.

## Verification Required

Run locally:

- apply `db/migrations/002_procedure_feedback.sql`
- npm run typecheck
- npm run build
- npm run test
