# Design — Evidence Source Action and Premium Citation Polish

## Autocrítica

The chat had improved synthesis and evidence visibility, but the citation excerpt treatment still looked like a prototype: a thick cyan rail suggested decoration rather than document evidence. More importantly, evidence UX was incomplete because a reviewer naturally expects a citation card to provide a path to the underlying source document when available.

## Design Direction

- Replace loud excerpt rails with quiet premium evidence surfaces.
- Keep the citation card as the primary evidence object.
- Make source availability explicit.
- Distinguish two states:
  - `Abrir fuente`: source metadata is available.
  - `Fuente no enlazada`: source metadata is not available yet.
- Ensure source actions do not interfere with citation expand/collapse.

## RAG UX Principle

A RAG answer is not finished when it shows a text excerpt. It is finished when the user can understand the claim, inspect the excerpt, and know whether they can open the source document behind it.

## Future Extension

A later feature should add a first-class PDF/source viewer if the corpus exposes stable document URLs and page anchors.
