# Current Progress

## Active Feature

026-chat-answer-quality-and-evidence-composition

## Last Completed Feature

023-frontend-localization-and-graph-polish

## State

review

## Summary

Feature 026 is implemented in SHIP mode and remains in review pending local command verification. This cycle improves the conversational layer of the embeddable chat widget: responses now render as synthesis-first municipal answers, evidence is separated from the answer but visible by default, raw retrieval-style dumps are suppressed from the primary answer, citation cards remain expandable, and broad queries receive guided follow-up chips.

Features 024 and 025 remain implemented but not locally closed because command verification was not run in this environment. To respect the harness one-active-feature rule, 026 is now the active review feature.

## Completed Implementation

026 updated:

- `public/widget.js`
- `src/__tests__/chat-answer-composition.test.ts`
- `specs/026-chat-answer-quality-and-evidence-composition/requirements.md`
- `specs/026-chat-answer-quality-and-evidence-composition/design.md`
- `specs/026-chat-answer-quality-and-evidence-composition/tasks.md`
- `feature_list.json`
- `progress/current.md`

## Acceptance Focus

- Assistant responses show a short synthesis before evidence.
- Retrieval-style answer content is detected and not rendered as the primary response when citations exist.
- Evidence is visible by default under `Fuentes verificadas`.
- The evidence toggle starts as `Ocultar evidencia`, not `Ver evidencia`.
- Users can still hide the evidence panel for compact reading.
- Citation cards remain expandable by click and keyboard.
- Broad queries such as `agua` produce guided follow-up chips.
- Theme extraction detects topics such as agua potable, aguas residuales, aguas pluviales, acueducto/abastecimiento, necesidades locales, and prioridades municipales.
- `/api/chat` request shape remains unchanged: `message`, `mode`, `limit`.
- `Palabras clave` and `Frase exacta` modes remain available.
- Shadow DOM, mobile layout, widget open/close, Enter send, Escape close, and reduced-motion protections remain preserved.

## Preserved Non-Goals

026 did not modify:

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

This follows the harness-sdlc control model: the requested conversational engineering improvement was promoted into Feature 026 with requirements, design, task checklist, bounded file scope, implementation, tests, and review status.

## Verification Required

Run locally before closing the feature:

- npm run typecheck
- npm run build
- npm run test

Manual frontend review required:

- Open `/` and launch the widget.
- Ask `agua`.
- Confirm the assistant starts with a synthesis, not a numbered retrieval dump.
- Confirm `Hallazgos clave` appears before evidence.
- Confirm `Fuentes verificadas` is visible by default.
- Confirm the evidence toggle starts as `Ocultar evidencia`.
- Hide/show the evidence panel.
- Expand/collapse individual citation cards.
- Click a follow-up chip such as `Aguas residuales` or `Agua potable y saneamiento`.
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
- 026-chat-answer-quality-and-evidence-composition: active review, pending local command verification

## Next Recommended Feature

027-chat-empty-state-and-answer-policy-refinement

Status: not started
