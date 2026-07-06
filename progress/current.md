# Current Progress

## Active Feature

none

## Last Completed Feature

033-github-pages-static-deploy

## State

done

## Summary

Feature 033 is closed. The repository now has a static-only GitHub Pages deployment path for the public frontend. The workflow builds `dist-pages` from `public/`, verifies the artifact, configures GitHub Pages with `enablement: true`, uploads the artifact, and deploys the static site.

The deploy was intentionally bounded to static frontend assets. Backend APIs, database logic, embeddings, secrets, environment files, retrieval ranking, answer generation, Glass Wall runtime behavior, and widget runtime behavior were not deployed or modified as part of the Pages feature.

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

## Final Acceptance

- GitHub Pages deploy workflow exists and runs from `main` or manual dispatch.
- Pages artifact is generated from `public/` only.
- `.nojekyll` is included in the artifact.
- Root-relative static references are patched for project-page hosting under `/LA_muni_RAG/`.
- Pages artifact verification checks required files and rejects unpatched root-relative references.
- The workflow is static-only and does not include backend typecheck/test/build gates.
- `actions/configure-pages@v5` uses `enablement: true` to handle repositories without an existing Pages site.
- The widget remains a static shell unless configured with a deployed API URL.

## Closing Notes

Local Pages verification commands:

- node scripts/build-pages.mjs
- node scripts/verify-pages-artifact.mjs

Repository health checks remain recommended separately:

- npm run typecheck
- npm run build
- npm run test

## Next Recommended Feature

034-pages-api-configuration-and-demo-mode
