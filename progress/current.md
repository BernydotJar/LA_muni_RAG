# Current Progress

## Active Feature

025-query-experience-and-evidence-panel

## Last Completed Feature

023-frontend-localization-and-graph-polish

## State

review

## Summary

Feature 025 is implemented in SHIP mode and remains in review pending local command verification. This cycle upgrades the embeddable chat widget from a functional chat window into a premium municipal evidence panel aligned with the refreshed public homepage.

Feature 024 remains implemented but not locally closed because command verification was not run in this environment. To respect the harness one-active-feature rule, 024 is now inactive review in `feature_list.json`, and 025 is the active review feature for the chat/evidence surface.

## Completed Implementation

025 updated:

- `public/widget.js`
- `src/__tests__/premium-chat-widget.test.ts`
- `specs/025-query-experience-and-evidence-panel/requirements.md`
- `specs/025-query-experience-and-evidence-panel/design.md`
- `specs/025-query-experience-and-evidence-panel/tasks.md`
- `feature_list.json`
- `progress/current.md`

## Acceptance Focus

- Widget shell feels like a premium municipal evidence console, not a generic chat box.
- Header uses civic status, evidence/citation rail, glass surface, and institutional hierarchy.
- Floating bubble uses premium orbital gradient motion.
- Assistant responses render as evidence panels with `Respuesta con evidencia` treatment.
- Citation cards render as expandable evidence dossiers with source badge, evidence index, label, excerpt, hover, and keyboard interaction.
- Search mode selector remains available for `Palabras clave` and `Frase exacta`.
- Composer uses premium glass styling and preserves keyboard behavior.
- Mobile layout remains usable below 480px.
- Reduced-motion rules protect widget animations.
- `/api/chat` behavior and request shape remain unchanged.

## Preserved Non-Goals

025 did not modify:

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

This follows the harness-sdlc control model: the requested chat refinement was promoted into Feature 025 with requirements, design, task checklist, bounded file scope, implementation, tests, and review status.

## Verification Required

Run locally before closing the feature:

- npm run typecheck
- npm run build
- npm run test

Manual frontend review required:

- Open `/` and launch the widget.
- Confirm the bubble feels premium and not generic.
- Confirm the header feels institutional and aligned with the homepage.
- Ask a query that returns evidence and confirm the assistant card reads as an evidence panel.
- Expand/collapse citation cards.
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
- 025-query-experience-and-evidence-panel: active review, pending local command verification

## Next Recommended Feature

026-chat-answer-quality-and-empty-state-copy

Status: not started
