# Current Progress

## Active Feature

032-corpus-source-url-metadata-ingestion

## State

review

## Summary

Feature 032 continues the harness workflow after the source-link contract. The initial schema already includes source URL columns on `rag.documents` and `rag.document_versions`, so this slice connects those existing fields to retrieval instead of adding a migration. Keyword and phrase search now select `COALESCE(v.source_url, d.source_url) AS source_url`, and the optional URL is preserved through evidence, hybrid candidates, vector candidates, chat citations, and the existing widget source action.

## Completed Implementation

032 updated or added:

- src/search.ts
- src/evidence.ts
- src/retrieval/types.ts
- src/retrieval/vectorRetriever.ts
- src/chat.ts
- src/__tests__/source-url-metadata-ingestion.test.ts
- specs/032-corpus-source-url-metadata-ingestion/requirements.md
- specs/032-corpus-source-url-metadata-ingestion/design.md
- specs/032-corpus-source-url-metadata-ingestion/tasks.md

## Acceptance Focus

- Keyword search returns optional sourceUrl from version-level URL first and document-level URL second.
- Phrase search returns optional sourceUrl using the same precedence.
- Evidence mappings preserve sourceUrl from search results.
- Hybrid candidates preserve sourceUrl from keyword, phrase, and vector paths.
- Chat citations pass through sourceUrl for widget rendering.
- Widget continues to show Abrir fuente only when sourceUrl exists.
- Widget continues to show Fuente no enlazada when sourceUrl is absent.
- No fake PDF links are generated from document titles.
- No PDF viewer is added before stable URL policy is validated.

## Preserved Non-Goals

032 did not modify ranking weights, answer generation, database schema, embeddings, auth, environment files, homepage layout, Glass Wall runtime behavior, or widget visual styling.

## Verification Required

Run locally before closing:

- npm run typecheck
- npm run build
- npm run test

Manual review:

- Seed or update one document/version with a safe source_url.
- Ask a query that retrieves that document.
- Confirm the widget shows Abrir fuente.
- Remove or omit source_url.
- Confirm the widget shows Fuente no enlazada.
- Confirm no storage_uri or internal path is exposed.

## Next Recommended Feature

033-source-url-seed-and-demo-document-fixture
