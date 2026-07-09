# Current Progress

## Active Feature

none

## Last Completed Feature

036-municipal-procedure-workflow-advisor

## State

done

## Mode

MVP

## Summary

Feature 036 is closed as an MVP. LA Muni RAG now has a Procedure Workflow Advisor layer on top of existing evidence retrieval. It can classify procedural municipal questions, retrieve supporting evidence through the current RAG path, compose structured workflows, attach citations to steps, detect missing documents, and distinguish Antigua evidence from external municipal references.

## Completed Implementation

036 added or updated:

- specs/036-municipal-procedure-workflow-advisor/requirements.md
- specs/036-municipal-procedure-workflow-advisor/design.md
- specs/036-municipal-procedure-workflow-advisor/tasks.md
- src/procedure/types.ts
- src/procedure/procedureClassifier.ts
- src/procedure/procedureAuthorities.ts
- src/procedure/procedureRetriever.ts
- src/procedure/procedureGaps.ts
- src/procedure/procedureComposer.ts
- src/procedure/index.ts
- src/server.ts
- src/__tests__/procedure-workflow-advisor.test.ts
- docs/procedure-workflow-advisor.md

## Final Acceptance

- The advisor is Antigua-first.
- Documents from other municipalities are treated as comparative `external_reference` material unless supported by Antigua documents or national law.
- The advisor does not invent procedures, deadlines, signatures, COCODE routes, approval chains, or project status.
- Case-specific questions such as San Mateo return required missing documents when no expediente evidence is present.
- `/api/procedure?q=...&mode=keyword&limit=8` returns structured workflow JSON.
- Stadium/public works, project closure, procurement, Mixco external reference, and missing COCODE deadline scenarios are covered by tests.

## Verification

Local verification was not run in this connector-only environment.

Run locally:

- npm run typecheck
- npm run build
- npm run test

## Next Recommended Feature

037-procedure-workflow-ui-cards
