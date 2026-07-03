# Current Progress

## Active Feature

018-file-backed-corpus-manifest

## State

review

## Summary

Feature 018 has been implemented in SHIP mode.

The implementation adds a JSON file-backed `CorpusManifestStore`, stable manifest JSON shape, missing-file behavior as empty manifest, persistent `put()` writes, deterministic `list()` order, invalid file handling, temp-file-and-rename style write safety, and offline tests using temp directories.

## Completed Implementation

018 added:

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

018 did not introduce:

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

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- missing manifest files behave as empty stores
- existing records can be read from disk
- `put()` persists records across store instances
- replacing a document key does not duplicate records
- `list()` returns deterministic `documentKey` order
- invalid JSON and invalid manifest shape fail clearly
- write path uses temp file plus rename
- existing in-memory manifest tests still pass
- existing server/vector indexing behavior remains unchanged

## Next Gate

Run local verification and review the implementation before moving 018 to done.
