# Current Progress

## Active Feature

None

## Last Completed Feature

042-domain-pack-template-foundation

## State

done

## Mode

MVP

## Summary

Feature 042 introduced the domain-pack foundation that moves LA Muni RAG from an Antigua-specific procedural assistant toward a reusable evidence-first procedural assistant template.

The default remains `municipal-antigua`, preserving Antigua-first behavior. Additional starter packs now load for `hr`, `finance`, `sales-sop`, and `custom`.

## Completed Implementation

042 added or updated:

- specs/042-domain-pack-template-foundation/requirements.md
- specs/042-domain-pack-template-foundation/design.md
- specs/042-domain-pack-template-foundation/tasks.md
- src/domain/types.ts
- src/domain/validation.ts
- src/domain/registry.ts
- src/domain/packs/common.ts
- src/domain/packs/municipal-antigua.ts
- src/domain/packs/hr.ts
- src/domain/packs/finance.ts
- src/domain/packs/sales-sop.ts
- src/domain/packs/custom.ts
- src/domain/packs/index.ts
- src/procedure/types.ts
- src/procedure/procedureClassifier.ts
- src/procedure/procedureAuthorities.ts
- src/procedure/procedureComposer.ts
- src/procedure/procedureGaps.ts
- src/procedure/index.ts
- src/procedureFeedback/types.ts
- src/procedureFeedback/validation.ts
- src/procedureFeedback/repository.ts
- src/server.ts
- public/procedure-workflow.html
- public/procedure-feedback.js
- public/procedure-feedback-dashboard.html
- public/pages-demo-api.js
- src/__tests__/domain-pack-template-foundation.test.ts
- src/__tests__/procedure-feedback-backend-api.test.ts
- src/__tests__/procedure-feedback-backend-security.test.ts
- src/__tests__/procedure-feedback-review-dashboard.test.ts
- src/__tests__/procedure-workflow-feedback-loop.test.ts
- src/__tests__/procedure-workflow-ui-cards.test.ts
- docs/domain-pack-template-foundation.md
- README.md
- .env.example

## Governance Acceptance

- `DOMAIN_PACK` defaults to `municipal-antigua`.
- Unsupported domain pack ids fail closed.
- `/health` exposes a safe active domain-pack summary.
- `ProcedureWorkflow.metadata` includes `domainPackId`, `domainPackName`, and `hasLocalEvidence`.
- `hasAntiguaEvidence` is retained for backward compatibility.
- Antigua remains official-document-first.
- Other municipal materials remain `external_reference` and require validation against Antigua documents and applicable national law.
- HR, finance, sales SOP, and custom starter packs generate neutral workflows without Antigua terminology.
- Procedure feedback validates domain pack ids and stores the active pack in existing JSON metadata.
- No database migration was required for this feature.
- Generated `dist-pages/` output was verified but not kept as a source change.

## Local Verification

Ran locally:

- npm run typecheck: passed
- npm run build: passed
- npm run test: 289 passed, 0 failed
- npm run build:pages: passed
- node scripts/verify-pages-artifact.mjs: passed

## Next Work

Recommended next features:

- 043-domain-pack-ingestion-metadata
- 044-domain-pack-ui-labels-and-routing
