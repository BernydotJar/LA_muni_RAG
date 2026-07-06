# Current Progress

## Active Feature

033-github-pages-static-deploy

## State

review

## Summary

Feature 033 adds a GitHub Pages deployment path for the static public frontend. The deploy initially failed because the workflow coupled a static Pages publish to repository-wide backend gates (`npm ci`, typecheck, tests, and server build). That made Pages fail on unrelated backend/CLI issues before a static artifact could be published. The workflow is now static-only: it checks out the repo, sets up Node 24, builds `dist-pages` from `public/`, verifies the artifact, and deploys it through GitHub Pages.

## Completed Implementation

033 added or updated:

- .github/workflows/deploy-pages.yml
- scripts/build-pages.mjs
- scripts/verify-pages-artifact.mjs
- package.json
- src/__tests__/github-pages-deploy.test.ts
- src/cli/backfillCorpus.ts
- src/__tests__/backfill-cli-type-narrowing.test.ts
- specs/033-github-pages-static-deploy/requirements.md
- specs/033-github-pages-static-deploy/design.md
- specs/033-github-pages-static-deploy/tasks.md

## Acceptance Focus

- GitHub Actions deploys GitHub Pages from a generated `dist-pages` artifact.
- The Pages workflow is bounded to static artifact build and verification.
- Pages artifact is generated from `public/` only.
- `.nojekyll` is included in the Pages artifact.
- Root-relative links are patched for project-page hosting under `/LA_muni_RAG/`.
- The Pages artifact verifier rejects unpatched root-relative static references.
- No backend API, DB connection, embeddings, secrets, env files, or repository-wide backend gates are part of the Pages deploy workflow.
- The chat widget remains static unless separately configured with a deployed API URL.

## Preserved Non-Goals

033 did not modify backend APIs, retrieval ranking, answer generation, corpus logic, database schema, embeddings, auth, environment files, Glass Wall runtime behavior, or widget runtime behavior.

## Verification Required

Run locally before closing:

- node scripts/build-pages.mjs
- node scripts/verify-pages-artifact.mjs

Recommended repository health checks, separate from Pages deploy:

- npm run typecheck
- npm run build
- npm run test

Manual GitHub review:

- Confirm the `Deploy GitHub Pages` workflow reruns successfully after the static-only correction.
- If GitHub asks for Pages source, set repository Settings → Pages → Source to GitHub Actions.
- Confirm published URL loads the homepage.
- Confirm `/glass-wall.html` loads from the published Pages URL.
- Confirm widget static shell opens.
- Confirm chat API still requires separate API deployment or `data-api-url` configuration.

## Next Recommended Feature

034-pages-api-configuration-and-demo-mode
