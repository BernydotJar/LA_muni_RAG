# Current Progress

## Active Feature

031-corpus-document-links-and-pdf-page-viewer

## State

review

## Summary

Feature 031 continues the harness workflow after the evidence-card critique pass. The next product gap is source opening: a municipal RAG citation should eventually let the reviewer open the underlying document or PDF page. The audit found that current search rows expose document title, type, citation label, page start, and excerpt, but not a stable source URL. This feature therefore adds the optional source-link contract through evidence, hybrid candidates, and chat citations without inventing fake links.

## Completed Implementation

031 updated or added:

- src/evidence.ts
- src/retrieval/types.ts
- src/chat.ts
- src/__tests__/source-link-contract.test.ts
- specs/031-corpus-document-links-and-pdf-page-viewer/requirements.md
- specs/031-corpus-document-links-and-pdf-page-viewer/design.md
- specs/031-corpus-document-links-and-pdf-page-viewer/tasks.md

## Acceptance Focus

- Evidence items can carry optional sourceUrl.
- Hybrid candidates can carry optional sourceUrl.
- Chat citations pass through sourceUrl when available.
- Widget source actions remain honest: Abrir fuente when URL exists, Fuente no enlazada when it does not.
- The system does not derive or invent PDF links from document names.
- PDF/page viewer remains gated until the corpus exposes stable document URLs.
- Existing /api/chat request shape remains unchanged.

## Preserved Non-Goals

031 did not modify ranking, answer generation, corpus ingestion, database schema, embeddings, auth, environment files, homepage layout, Glass Wall runtime behavior, or widget visual styling.

## Verification Required

Run locally before closing:

- npm run typecheck
- npm run build
- npm run test

Manual review:

- Open the homepage.
- Launch the municipal assistant.
- Ask necesidades mas urgentes.
- Confirm citations still show Fuente no enlazada with the current corpus.
- Test a mocked chat payload containing sourceUrl and confirm the widget shows Abrir fuente.
- Confirm no fake PDF links appear when sourceUrl is absent.

## Next Recommended Feature

032-corpus-source-url-metadata-ingestion
