# Current Progress

## Active Feature

None.

## Last Completed Feature

017-corpus-backfill-manifest

## State

done

## Summary

Feature 017 has been completed in SHIP mode.

The implementation adds a manifest record model, manifest status values, an in-memory manifest store, deterministic reindex decision logic, explicit-document backfill orchestration, and offline tests for indexed, skipped, stale/reindex, retry, and failed paths.

## Completed Implementation

- `CorpusManifestRecord`
- `CorpusManifestStatus`
- `CorpusManifestStore`
- `InMemoryCorpusManifestStore`
- `CorpusBackfillDocumentInput`
- `CorpusBackfillResult`
- `CorpusBackfillDecision`
- `computeCorpusContentSha256()`
- `decideCorpusBackfill()`
- `backfillCorpusManifest()`
- offline tests for first-time indexing
- offline tests for unchanged skip
- offline tests for stale/reindex due to content hash
- offline tests for stale/reindex due to embedding metadata
- offline tests for retry after failed prior record
- offline tests for failed indexing manifest update

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

## Verification

Local verification passed:

- npm run typecheck
- npm run build
- npm run test

Test result:

- 135 tests
- 135 passing
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

## Next Recommended Feature

018-file-backed-corpus-manifest

Status: not started
