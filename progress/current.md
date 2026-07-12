# Current Progress

## Active Feature

None

## Last Completed Feature

044-domain-pack-ui-labels-and-routing

## State

done

## Mode

MVP

## Summary

Feature 044 exposed safe active domain-pack UI metadata and made the procedure workflow page adapt labels and default prompts for non-municipal domain packs.

## Completed Implementation

044 added or updated:

- specs/044-domain-pack-ui-labels-and-routing/requirements.md
- specs/044-domain-pack-ui-labels-and-routing/design.md
- specs/044-domain-pack-ui-labels-and-routing/tasks.md
- src/domain/registry.ts
- src/server.ts
- public/procedure-workflow.html
- public/pages-demo-api.js
- src/__tests__/domain-pack-template-foundation.test.ts
- src/__tests__/procedure-workflow-ui-cards.test.ts
- docs/domain-pack-ui-labels-and-routing.md
- README.md
- progress/current.md

## Governance Acceptance

- `GET /api/domain-pack` returns safe active pack UI metadata.
- The endpoint does not expose secrets, environment variables, database URLs, tokens, or runtime dependency internals.
- The public UI still falls back to Antigua-first copy.
- Non-municipal packs can show neutral workflow language and pack-specific prompts.
- Public users cannot switch packs by query string; the active pack remains server-side.
- GitHub Pages demo/proxy mode handles `/api/domain-pack`.
- Existing `/api/procedure` behavior remains unchanged.
- Generated `dist-pages/` output was verified but not kept as a source change.

## Local Verification

Ran locally:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 296 passed, 0 failed
- npm run build:pages: passed
- node scripts/verify-pages-artifact.mjs: passed

## Next Work

Recommended next features:

- 045-domain-pack-admin-intake
- 046-domain-pack-evaluation-harness
