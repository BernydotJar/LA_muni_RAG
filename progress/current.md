# Current Progress

## Active Feature

033-github-pages-static-deploy

## State

review

## Summary

Feature 033 adds a GitHub Pages deployment path for the static public frontend. The deployment is intentionally bounded to static files under `public/`: homepage, Glass Wall, widget script, and assets. The backend RAG API, PostgreSQL, embeddings, environment variables, and secrets remain outside the Pages artifact.

## Completed Implementation

033 added or updated:

- .github/workflows/deploy-pages.yml
- scripts/build-pages.mjs
- package.json
- src/__tests__/github-pages-deploy.test.ts
- specs/033-github-pages-static-deploy/requirements.md
- specs/033-github-pages-static-deploy/design.md
- specs/033-github-pages-static-deploy/tasks.md

## Acceptance Focus

- GitHub Actions deploys GitHub Pages from a generated `dist-pages` artifact.
- The workflow runs typecheck, tests, TypeScript build, and Pages build before deploy.
- Pages artifact is generated from `public/` only.
- `.nojekyll` is included in the Pages artifact.
- Root-relative links are patched for project-page hosting under `/LA_muni_RAG/`.
- No backend API, DB connection, embeddings, secrets, or env files are deployed to Pages.
- The chat widget remains static unless separately configured with a deployed API URL.

## Preserved Non-Goals

033 did not modify backend APIs, retrieval ranking, answer generation, corpus logic, database schema, embeddings, auth, environment files, Glass Wall runtime behavior, or widget runtime behavior.

## Verification Required

Run locally before closing:

- npm run typecheck
- npm run build
- npm run test
- npm run build:pages

Manual GitHub review:

- Confirm the `Deploy GitHub Pages` workflow runs successfully after push to main.
- If GitHub asks for Pages source, set repository Settings → Pages → Source to GitHub Actions.
- Confirm published URL loads the homepage.
- Confirm `/glass-wall.html` loads from the published Pages URL.
- Confirm widget static shell opens.
- Confirm chat API still requires separate API deployment or `data-api-url` configuration.

## Next Recommended Feature

034-pages-api-configuration-and-demo-mode
