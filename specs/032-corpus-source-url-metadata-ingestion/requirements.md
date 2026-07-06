# Feature 032 — Corpus Source URL Metadata Ingestion

## Objective

Connect the source-link contract from Feature 031 to actual retrieval metadata by reading stable document URLs already present in the database schema and passing them into keyword, phrase, hybrid, vector, evidence, chat, and widget citation flows.

## Requirements

1. Keyword search must select a stable source URL from document version metadata first, then document metadata.
2. Phrase search must select the same stable source URL fallback.
3. Search result contracts must expose `sourceUrl?: string | null`.
4. Evidence mappings must preserve source URLs from keyword and phrase results.
5. Hybrid candidates must preserve source URLs from keyword, phrase, and vector retrieval paths.
6. Vector candidate inputs must allow source URLs so production vector repositories can pass them forward.
7. Chat citations must continue to expose `sourceUrl` for widget rendering.
8. The widget must not invent links when `sourceUrl` is absent.
9. No new viewer should be added until real source URLs can be verified in corpus data.

## Non-goals

- No PDF modal viewer in this feature.
- No new dependency.
- No ranking change.
- No answer-generation change.
- No database migration: the initial schema already includes `rag.documents.source_url` and `rag.document_versions.source_url`.
