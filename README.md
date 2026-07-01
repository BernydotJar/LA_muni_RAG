# LA Muni RAG

Last updated: 2026-06-21
Status: Production foundation in progress

AI agent and retrieval system for the Municipality of La Antigua Guatemala,
Sacatepequez.

## Product Intent

Build a production-grade RAG agent that answers questions about municipal,
constitutional, administrative, planning, construction, and heritage-related
documents with cited evidence.

The product must distinguish:

- `implemented`: behavior supported by code and validation
- `draft`: generated text requiring human review
- `interpretation`: reasoned explanation grounded in cited sources
- `not_found`: no sufficient evidence in the corpus

## First Build Slice

The first implementation cycle starts with PostgreSQL:

- document registry
- document versions
- citable document sections
- hybrid search support: full-text + pgvector
- ingestion job tracking
- agent run and citation audit tables
- first page-level extraction path for the PDM-OT
- keyword retrieval baseline for PDM-OT evidence
- local TypeScript CLI for cited retrieval
- native TypeScript HTTP API for cited retrieval
- evidence-first API response for future agent grounding
- `sourceType` field in evidence responses (from `document_type` in database)
- semi-agent reasoning layer: sufficiency heuristics, confidence, summary
- `GET /api/agent` endpoint for evidence-grounded agent context
- `npm run dev:start` to free project ports and run the API on `4010`
- `npm run test` — unit and integration tests with Node built-in runner

## Local Database

Recommended database name:

```text
la_muni_rag
```

Initial migration:

```text
db/migrations/001_initial_rag_schema.sql
```

Initial seed:

```text
db/seeds/001_core_documents.sql
db/seeds/002_document_versions.sql
```

Run it from pgAdmin Query Tool after creating the database, or from `psql`:

```bash
psql "postgresql://USER:PASSWORD@localhost:5432/la_muni_rag" \
  -f db/migrations/001_initial_rag_schema.sql
```

Then register the first canonical document records:

```bash
psql "postgresql://USER:PASSWORD@localhost:5432/la_muni_rag" \
  -f db/seeds/001_core_documents.sql
```

Then register verified local document versions:

```bash
psql "postgresql://USER:PASSWORD@localhost:5432/la_muni_rag" \
  -f db/seeds/002_document_versions.sql
```
