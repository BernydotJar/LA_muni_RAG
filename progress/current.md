# Current Progress

## Active Feature

030-evidence-source-action-and-premium-citation-polish

## State

review

## Summary

Feature 030 applies a critique pass to the RAG chat evidence UI. The manual review found three issues: the answer header labels were visually colliding, evidence cards were too dense for a municipal demo, and the source action state needed to feel less like debug metadata.

## Completed Implementation

030 updated:

- public/widget.js
- src/__tests__/chat-answer-composition.test.ts
- src/__tests__/premium-chat-widget.test.ts
- specs/030-evidence-source-action-and-premium-citation-polish/requirements.md
- specs/030-evidence-source-action-and-premium-citation-polish/design.md
- specs/030-evidence-source-action-and-premium-citation-polish/tasks.md

## Acceptance Focus

- Response labels no longer read as a single run-on phrase.
- Citation excerpts no longer use a heavy decorative rail.
- Citation metadata is less dense by default.
- Source availability is explicit as Abrir fuente or Fuente no enlazada.
- Source action does not toggle citation expansion.
- Citation body still expands and collapses.
- Evidence remains visible by default.
- The existing chat API request shape remains unchanged.

## Verification Required

Run locally before closing:

- npm run typecheck
- npm run build
- npm run test

Manual review:

- Open the homepage.
- Launch the municipal assistant.
- Ask necesidades mas urgentes.
- Confirm the answer header has clean spacing.
- Confirm evidence cards are less dense.
- Confirm the source action is readable and not visually dominant.
- Confirm citation body expansion still works.

## Next Recommended Feature

031-corpus-document-links-and-pdf-page-viewer
