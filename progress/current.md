# Current Progress

## Active Feature

017-corpus-backfill-manifest

## State

spec_ready

## Summary

Feature 017 has been opened in SHIP mode as a specification-only change.

The goal is to define a manifest-driven corpus backfill state model that tracks indexed documents, content hashes, document versions, embedding metadata, chunk counts, timestamps, statuses, and reindex decisions.

## Repository State

Local and GitHub were synchronized after 016 completion before opening this feature.

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
- 016-ingestion-cli-vector-indexing: done

## Current Feature Scope

017 must define:

- corpus manifest record model
- manifest status values
- manifest store boundary
- deterministic reindex decision logic
- explicit-document backfill orchestration
- safe backfill summary
- offline tests without hosted provider calls or live database dependencies

## Non-Goals

017 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- new source extractors
- env or secret files
- migrations unless separately approved
- package changes unless separately approved
- production scheduler
- full corpus management UI
- evidence policy changes
- vector ranking changes

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 017-corpus-backfill-manifest for implementation in SHIP mode.`
