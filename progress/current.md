# Current Progress

## Active Feature

029-demo-script-and-governance-pack

## Last Completed Feature

023-frontend-localization-and-graph-polish

## State

review

## Summary

Feature 029 adds a municipal presentation and governance pack for LA Muni RAG. The product was already visually and conversationally improved through Features 024 through 028; this cycle adds the missing readiness layer for a real municipal stakeholder presentation: a presenter script, approved demo questions, stakeholder talking points, governance boundaries, evidence interpretation guidance, and static tests.

Feature 028 remains implemented but inactive review pending local command verification. Feature 029 is now the active review feature.

## Completed Implementation

029 added:

- `docs/municipal-demo-script.md`
- `docs/municipal-governance-readiness.md`
- `src/__tests__/municipal-demo-governance-pack.test.ts`
- `specs/029-demo-script-and-governance-pack/requirements.md`
- `specs/029-demo-script-and-governance-pack/design.md`
- `specs/029-demo-script-and-governance-pack/tasks.md`
- `progress/current.md`

## Acceptance Focus

- Demo script is ready for a 7 to 10 minute municipal presentation.
- Demo script includes approved queries: `necesidades más urgentes`, `agua`, use of sources, and Glass Wall inspection.
- Governance guide explains acceptable claims and limits in Spanish.
- Governance guide includes evidence policy, human review, corpus readiness, and stakeholder objection handling.
- Static tests verify the pack exists and contains required municipal-readiness sections.
- Runtime behavior remains unchanged.

## Preserved Non-Goals

029 did not modify:

- backend APIs
- retrieval ranking
- evidence policy
- answer generation
- corpus or backfill logic
- package files
- migrations
- auth
- environment files
- database or embedding behavior
- homepage layout
- Glass Wall runtime behavior
- widget runtime behavior

## Harness Note

This follows the harness-sdlc control model: the improvement was promoted into a bounded feature with requirements, design, task checklist, implementation, tests, and review status.

## Verification Required

Run locally before closing the feature:

- npm run typecheck
- npm run build
- npm run test

Manual review required:

- Read `docs/municipal-demo-script.md` from the perspective of a municipal presenter.
- Read `docs/municipal-governance-readiness.md` from the perspective of legal, IT, communications, and council stakeholders.
- Open `/` and launch the widget.
- Ask `necesidades más urgentes`.
- Confirm the answer shows synthesis, findings, visible sources, and institutional evidence labels.
- Ask `agua`.
- Confirm evidence cards remain visible and readable.
- Open `/glass-wall.html` and inspect a query.
- Confirm the presenter can explain lexical, phrase, and vector routes using the governance language.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done
- 013-production-query-embedding-provider: done
- 014-runtime-vector-wiring: done
- 015-runtime-vector-observability: done
- 016-ingestion-cli-vector-indexing: done
- 017-corpus-backfill-manifest: done
- 018-file-backed-corpus-manifest: done
- 019-rag-glass-wall-easter-egg: done
- 020-corpus-backfill-cli: done
- 021-retrieval-eval-harness: done
- 022-premium-rag-frontend-refresh: done
- 023-frontend-localization-and-graph-polish: done

## Features In Review

- 024-frontend-responsive-layout-stabilization: inactive review, pending local command verification
- 025-query-experience-and-evidence-panel: inactive review, pending local command verification
- 026-chat-answer-quality-and-evidence-composition: inactive review, pending local command verification
- 027-glass-wall-vector-runtime-insights: inactive review, pending local command verification
- 028-municipal-demo-readiness-and-evidence-copy-polish: inactive review, pending local command verification
- 029-demo-script-and-governance-pack: active review, pending local command verification

## Next Recommended Feature

030-corpus-metadata-and-public-update-stamp

Status: not started
