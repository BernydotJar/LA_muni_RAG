# Current Progress

## Active Feature

016-ingestion-cli-vector-indexing

## State

spec_ready

## Summary

Feature 016 has been opened in SHIP mode as a specification-only change.

The goal is to define an operational CLI path that can ingest supported source documents, plan deterministic chunks, generate embeddings through the configured provider, and persist vectors into pgvector with safe reporting.

## Repository State

Local and GitHub were synchronized after 015 completion before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done
- 013-production-query-embedding-provider: done
- 014-runtime-vector-wiring: done
- 015-runtime-vector-observability: done

## Current Feature Scope

016 must define:

- CLI-ready vector indexing path
- reuse of existing source extraction and normalization
- reuse of existing deterministic chunk planning
- reuse of existing embedding provider boundary
- reuse of existing pgvector repository boundary
- safe operator reporting
- offline tests without hosted provider calls

## Non-Goals

016 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- new source extractors
- env or secret files
- bulk production scheduling
- full corpus management UI
- evidence policy changes

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 016-ingestion-cli-vector-indexing for implementation in SHIP mode.`
