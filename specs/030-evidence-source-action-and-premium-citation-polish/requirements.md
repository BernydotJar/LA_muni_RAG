# Feature 030 — Evidence Source Action and Premium Citation Polish

## Objective

Improve the RAG chat evidence experience so citation cards feel premium, less prototype-like, and closer to how a municipal reviewer expects to inspect sources.

## Requirements

1. Remove the heavy decorative cyan excerpt rail from citation excerpts.
2. Keep citation excerpts readable and premium with subtle border, background, and spacing.
3. Add a source action affordance on each citation card.
4. If a citation includes source URL metadata, show `Abrir fuente`.
5. If no source URL metadata is available, show `Fuente no enlazada` so the limitation is explicit.
6. Prevent source-action clicks from accidentally toggling the citation expansion state.
7. Preserve citation expansion, keyboard behavior, evidence visible by default, and follow-up chips.
8. Preserve `/api/chat` request shape and search modes.
9. Add static tests for citation polish and source-action behavior.

## Non-goals

- No backend change.
- No retrieval ranking change.
- No corpus or embedding change.
- No PDF viewer implementation in this feature.
- No new dependency.
