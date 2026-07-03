# Current Progress

## Active Feature

None.

## Last Completed Feature

018-file-backed-corpus-manifest

## State

done

## Summary

Feature 018 has been completed in SHIP mode.

The implementation adds a JSON file-backed `CorpusManifestStore`, stable manifest JSON shape, missing-file behavior as empty manifest, persistent `put()` writes, deterministic `list()` order, invalid file handling, temp-file-and-rename style write safety, and offline tests using temp directories.

## Completed Implementation

- `CorpusManifestFile`
- `CorpusManifestFileError`
- `JsonFileCorpusManifestStore`
- missing file handling as empty manifest
- JSON shape validation for top-level object, `schemaVersion`, `records`, and record `documentKey`
- deterministic record sorting by `documentKey`
- temp-file-and-rename writes
- offline tests for missing file behavior
- offline tests for reading existing manifest records
- offline tests for persisted writes across store instances
- offline tests for replacing existing document keys
- offline tests for deterministic list order
- offline tests for stable JSON shape
- offline tests for invalid JSON
- offline tests for invalid manifest shape
- offline tests for invalid record document keys

## Preserved Non-Goals

- no LLM answer generation
- no LLM reranking
- no UI changes
- no auth changes
- no new source extractors
- no env or secret files
- no migrations
- no package changes
- no production scheduler
- no full corpus management UI
- no evidence policy changes
- no vector ranking changes
- no server routes

## Verification

Local verification passed:

- npm run typecheck
- npm run build
- npm run test

Test result:

- 144 tests
- 144 passing
- 0 failing
- 0 cancelled
- 0 skipped
- 0 todo

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
- 018-file-backed-corpus-manifest: done

## Next Recommended Feature

019-corpus-backfill-cli

Status: not started
