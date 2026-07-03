# Current Progress

## Active Feature

018-file-backed-corpus-manifest

## State

spec_ready

## Summary

Feature 018 has been opened in SHIP mode as a specification-only change.

The goal is to define a JSON file-backed corpus manifest store that persists backfill state across local/operator runs without introducing database migrations, scheduler, UI, package changes, or runtime answer changes.

## Repository State

Local and GitHub were synchronized after 017 completion before opening this feature.

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
- 017-corpus-backfill-manifest: done

## Current Feature Scope

018 must define:

- JSON file-backed `CorpusManifestStore`
- stable manifest JSON shape
- missing-file behavior as empty manifest
- persistent `put()` writes
- deterministic `list()` order
- invalid file handling
- temp-file-and-rename style write safety
- offline tests using temp directories

## Non-Goals

018 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- new source extractors
- env or secret files
- migrations
- package changes
- production scheduler
- full corpus management UI
- evidence policy changes
- vector ranking changes
- server routes

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 018-file-backed-corpus-manifest for implementation in SHIP mode.`
