# Feature 031 — Corpus Document Links and PDF Page Viewer

## Objective

Prepare the RAG evidence pipeline for first-class document opening by carrying optional public source URLs from retrieval results through evidence and chat citations.

## Requirements

1. Evidence items expose an optional `sourceUrl` field.
2. Hybrid candidates can carry optional `sourceUrl` metadata.
3. Chat citations pass through `sourceUrl` when available.
4. The widget continues to show `Abrir fuente` when a citation includes source URL metadata.
5. The widget continues to show `Fuente no enlazada` when current corpus rows do not provide a URL.
6. Do not invent links from document titles or citation labels.
7. Do not add a fake PDF viewer until stable corpus document URLs exist.
8. Preserve `/api/chat` request shape, retrieval ranking, answer generation, and existing citation visibility.

## Current Metadata Finding

The current keyword and phrase database queries expose document title, document type, citation label, page start, score/snippet or preview. They do not expose a stable public document URL yet. Therefore, this feature adds the contract and pass-through path, while the actual viewer remains gated on corpus metadata.

## Non-goals

- No new database migration in this slice.
- No fake PDF link generation.
- No new endpoint.
- No PDF renderer dependency.
- No change to ranking or answer text generation.
