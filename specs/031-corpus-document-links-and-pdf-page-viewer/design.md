# Design — Corpus Document Links and PDF Page Viewer

## Product Principle

A municipal RAG citation should eventually let a reviewer open the underlying document and page. Until the corpus exposes stable document URLs, the UI must be honest: it can show the excerpt and page metadata, but must mark the source as not linked.

## Current State

The widget already has two source-action states:

- `Abrir fuente` when URL metadata exists.
- `Fuente no enlazada` when URL metadata does not exist.

Feature 031 adds the backend-side citation contract required for that UI to become functional when corpus metadata is available.

## Data Flow

1. Search or vector retrieval finds evidence.
2. Evidence item carries `sourceUrl?: string | null`.
3. Agent response preserves evidence.
4. Chat citation includes `sourceUrl?: string | null`.
5. Widget reads `citation.sourceUrl` and renders the correct source action.

## Viewer Strategy

Do not create a PDF viewer until there are stable public or authenticated document URLs. Once the corpus exposes them, the next implementation can add:

- modal document viewer;
- page anchor handling;
- open-in-new-tab fallback;
- citation-page deep links;
- document metadata panel.

## Safety Rules

- Never infer source URLs from document names.
- Never expose internal storage paths.
- Never expose private bucket URLs unless they are deliberately signed or public.
- Prefer explicit `sourceUrl` over derived links.
