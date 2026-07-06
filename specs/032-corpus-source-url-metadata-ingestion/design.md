# Design — Corpus Source URL Metadata Ingestion

## Rationale

The initial database schema already contains two source URL fields:

- `rag.documents.source_url`
- `rag.document_versions.source_url`

Feature 031 created the optional citation contract. Feature 032 connects that contract to retrieval by selecting source URL metadata directly in search queries and preserving it through the RAG pipeline.

## URL Precedence

Use this precedence:

1. `rag.document_versions.source_url`
2. `rag.documents.source_url`
3. `null`

Version-level source URLs win because a specific version can point to a specific uploaded PDF, signed URL, or official document location.

## Retrieval Flow

```text
rag.documents/source_url
        ↓
search.ts keyword/phrase rows
        ↓
evidence.ts mappings
        ↓
hybrid candidate merge
        ↓
chat.ts citations
        ↓
widget source action
```

## Safety

- The system only passes explicit source URLs from corpus metadata.
- It does not derive PDF links from titles.
- It does not expose `storage_uri`.
- It does not expose internal bucket paths.
- If metadata is missing, the widget keeps showing `Fuente no enlazada`.

## Viewer Boundary

A PDF viewer remains out of scope. A viewer should only be implemented after there is a verified source URL policy: public URL, signed URL, authenticated route, or static document asset route.
