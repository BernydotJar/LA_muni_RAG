# Document Registry

Last updated: 2026-06-22
Owner: Product Engineering
Status: Draft

## Objective

Track which legal, municipal, planning, and heritage documents are registered
for the La Antigua Guatemala RAG corpus before text extraction begins.

## Production Rule

Do not ingest extracted text as authoritative until the source record identifies:

- issuing authority
- source kind
- source URL or storage URI
- official-source flag
- status or explicit vigency-review requirement

## Current Seed

Run after `db/migrations/001_initial_rag_schema.sql`:

```sql
-- In pgAdmin Query Tool, open and run:
-- /Users/eduardosacahui/Github-Repos/LA_muni_RAG/db/seeds/001_core_documents.sql
```

The seed registers:

- Constitucion Politica de la Republica de Guatemala
- Codigo Municipal, Decreto Numero 12-2002
- PDM-OT de Antigua Guatemala
- Ley Protectora de la Ciudad de La Antigua Guatemala, Decreto Numero 60-69

## Verification Query

```sql
SELECT
  d.title,
  d.document_scope,
  d.document_type,
  d.official_source,
  d.status,
  d.source_url,
  d.metadata
FROM rag.documents d
ORDER BY d.document_scope, d.title;
```

## Extraction Artifacts

Generated extraction files belong under `artifacts/` and are not committed by
default. They should be reproducible from:

- the verified source file in `data/raw/`
- the script under `scripts/`
- the document title and version label in `rag.document_versions`

## Mentor Note

The registry is not the corpus yet. It is the accession log: the disciplined
record that says, "this source exists, this is where it came from, this is how
much trust we assign to it right now."

That distinction matters because a legal RAG system fails in two ways:

1. It cannot find relevant text.
2. It finds text but cannot prove the text is authoritative, current, or
   applicable.

The registry protects against the second failure.
