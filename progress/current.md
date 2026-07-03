# Current Progress

## Active Feature

017-corpus-backfill-manifest

## State

review

## Summary

Feature 017 has been implemented in SHIP mode.

The implementation adds a manifest record model, manifest status values, an in-memory manifest store, deterministic reindex decision logic, explicit-document backfill orchestration, and offline tests for indexed, skipped, stale/reindex, retry, and failed paths.

## Completed Implementation

017 added:

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

017 did not introduce:

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

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- manifest records capture document and embedding metadata needed for reindex decisions
- unchanged indexed records are skipped without calling the indexer
- changed content hash triggers reindex
- changed embedding model/provider/dimension triggers reindex
- failed prior records trigger retry
- failed indexing writes failed manifest state safely
- tests do not call hosted providers or a live database
- existing server/vector indexing behavior remains unchanged

## Next Gate

Run local verification and review the implementation before moving 017 to done.
