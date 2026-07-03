# Current Progress

## Active Feature

016-ingestion-cli-vector-indexing

## State

review

## Summary

Feature 016 has been implemented in SHIP mode.

The implementation adds a CLI-ready vector indexing orchestrator, a direct CLI entry point, safe indexing result formatting, and offline tests for successful indexing and failure paths.

## Completed Implementation

016 added:

- `indexVectorSource()` orchestration boundary
- `VectorIndexingInput`
- `VectorIndexingResult`
- `VectorIndexingDependencies`
- `queryProviderToEmbeddingProvider()` adapter
- safe failure redaction for formatted output
- direct CLI entry point at `src/cli/indexVector.ts`
- offline success test for vector indexing
- offline tests for missing input, missing provider config, missing vector store config, provider failure, write failure, and no secret leakage

## Preserved Non-Goals

016 did not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- new source extractors
- env or secret files
- migrations
- package changes
- bulk production scheduling
- full corpus management UI
- evidence policy changes

## CLI Usage

Current direct command shape:

```bash
node --import tsx src/cli/indexVector.ts --input path/to/document.md --document-key document-key --document-version v1
```

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- the orchestrator reuses existing ingestion/extraction boundaries
- chunk planning uses existing deterministic chunk planner through `indexDocument()`
- production path can construct the configured query embedding provider
- production path can construct the pgvector repository only when vector store config exists
- CLI output does not leak sensitive config values
- tests do not call hosted providers or a live database
- server behavior remains unchanged

## Next Gate

Run local verification and review the implementation before moving 016 to done.
