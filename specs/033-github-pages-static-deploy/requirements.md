# Feature 033 — GitHub Pages Static Deploy

## Objective

Publish the public static frontend of LA Muni RAG through GitHub Pages while preserving the backend RAG runtime as a separate deployment concern.

## Requirements

1. Add a GitHub Actions workflow that deploys the static `public/` frontend to GitHub Pages.
2. Keep deployment bounded to static assets: homepage, Glass Wall, widget script, SVG assets, and related frontend files.
3. Do not deploy backend APIs, database logic, embeddings, or environment secrets to GitHub Pages.
4. Add a Pages build script that stages static files into a deterministic output directory.
5. Patch root-relative static links during the Pages build so project pages work under `/LA_muni_RAG/`.
6. Add `.nojekyll` to the Pages artifact so GitHub Pages serves all static files as-is.
7. Add a Pages artifact verification script for static deploy invariants.
8. Keep the Pages deploy workflow decoupled from backend typecheck/test/build gates; those gates belong in a separate CI workflow.
9. Document that chat API calls still require a separately deployed API or explicit `data-api-url` configuration.

## Non-goals

- No backend deployment.
- No database deployment.
- No secrets in Pages.
- No fake API endpoint.
- No mocked public RAG answers for production.
- No repository-wide backend CI gate inside the static Pages deploy workflow.
