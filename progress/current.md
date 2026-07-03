# Current Progress

## Active Feature

None.

## Last Completed Feature

016-ingestion-cli-vector-indexing

## State

done

## Summary

Feature 016 has been completed in SHIP mode.

The implementation adds a CLI-ready vector indexing orchestrator, a direct CLI entry point, safe indexing result formatting, and offline tests for successful indexing and failure paths.

## Completed Implementation

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

- no LLM answer generation
- no LLM reranking
- no UI changes
- no auth changes
- no new source extractors
- no env or secret files
- no migrations
- no package changes
- no bulk production scheduling
- no full corpus management UI
- no evidence policy changes

## CLI Usage

Current direct command shape:

```bash
node --import tsx src/cli/indexVector.ts --input path/to/document.md --document-key document-key --document-version v1
```

## Verification

Local verification passed:

- npm run typecheck
- npm run build
- npm run test

Test result:

- 125 tests
- 125 passing
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

## Next Recommended Feature

017-corpus-backfill-manifest

Status: not started
