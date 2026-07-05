# Current Progress

## Active Feature

028-municipal-demo-readiness-and-evidence-copy-polish

## Last Completed Feature

023-frontend-localization-and-graph-polish

## State

review

## Summary

Feature 028 is implemented in SHIP mode and remains in review pending local command verification. This cycle finishes the municipal-facing demo polish for the embeddable assistant: answers now use institutional sections, evidence labels avoid alarming raw confidence copy, citations include source metadata and relevance reasons, visible excerpts are cleaned for PDF extraction artifacts, the answer includes a traceability seal, and the welcome state includes demo-ready prompts for a municipal presentation.

Features 024, 025, 026, and 027 remain implemented but not locally closed because command verification was not run in this environment. To respect the harness one-active-feature rule, 028 is now the active review feature.

## Completed Implementation

028 updated:

- `public/widget.js`
- `src/__tests__/chat-answer-composition.test.ts`
- `src/__tests__/municipal-demo-readiness.test.ts`
- `specs/028-municipal-demo-readiness-and-evidence-copy-polish/requirements.md`
- `specs/028-municipal-demo-readiness-and-evidence-copy-polish/design.md`
- `specs/028-municipal-demo-readiness-and-evidence-copy-polish/tasks.md`
- `feature_list.json`
- `progress/current.md`

## Acceptance Focus

- Widget welcome state includes stable municipal demo prompts.
- Assistant responses use `Respuesta breve`, `Hallazgos principales`, and `Fuentes verificadas` hierarchy.
- Raw confidence wording is replaced with institutional evidence-status labels: `Evidencia sólida`, `Evidencia suficiente`, and `Evidencia limitada`.
- Citation excerpts are cleaned for common PDF hyphenation and spacing artifacts.
- Citation cards include document, page, type, and evidence-use metadata.
- Each source includes a short safe relevance reason.
- Evidence remains visible by default and can still be hidden for compact reading.
- Evidence cards remain expandable by click and keyboard.
- Evidence-backed answers include a traceability seal.
- `/api/chat` request shape remains unchanged: `message`, `mode`, `limit`.
- `Palabras clave` and `Frase exacta` modes remain available.
- Shadow DOM, mobile layout, widget open/close, Enter send, Escape close, and reduced-motion protections remain preserved.

## Preserved Non-Goals

028 did not modify:

- backend APIs
- retrieval ranking
- evidence policy
- answer generation
- corpus or backfill logic
- package files
- migrations
- auth
- environment files
- secrets
- Glass Wall endpoint allowlist
- homepage hero asset
- database or embedding behavior

## Harness Note

This follows the harness-sdlc control model: the requested municipal demo readiness improvement was promoted into Feature 028 with requirements, design, task checklist, bounded file scope, implementation, tests, and review status.

## Verification Required

Run locally before closing the feature:

- npm run typecheck
- npm run build
- npm run test

Manual frontend review required:

- Open `/` and launch the widget.
- Confirm the welcome state shows municipal demo prompts.
- Ask `necesidades más urgentes`.
- Confirm the answer starts with `Respuesta breve`.
- Confirm `Hallazgos principales` appears before `Fuentes verificadas`.
- Confirm evidence labels use `Evidencia limitada`, `Evidencia suficiente`, or `Evidencia sólida`.
- Confirm source cards include document, page, type, usage, excerpt, and relevance reason.
- Confirm the traceability seal is visible.
- Hide/show the evidence panel.
- Expand/collapse individual citation cards.
- Switch between `Palabras clave` and `Frase exacta`.
- Test mobile width below 480px.
- Confirm the widget still sends requests to `/api/chat`.
- Confirm reduced-motion preference disables decorative animation.

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
- 028-municipal-demo-readiness-and-evidence-copy-polish: active review, pending local command verification

## Next Recommended Feature

029-demo-script-and-governance-pack

Status: not started
