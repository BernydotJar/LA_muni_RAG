# Current Progress

## Active Feature

None.

## Last Completed Feature

013-production-query-embedding-provider

## State

done

## Summary

Feature 013 has been completed in SHIP mode.

The implementation adds an HTTP query embedding provider behind the existing `QueryEmbeddingProvider` boundary, plus a configuration-safe factory and offline tests using injected transport.

## Completed Implementation

- `HttpQueryEmbeddingProvider`
- fetch-compatible transport boundary
- provider response mapping
- stable provider error mapping
- query embedding dimension validation through the existing boundary
- `loadQueryEmbeddingProviderConfig()`
- `createQueryEmbeddingProvider()`
- configuration-safe provider construction
- offline tests for provider behavior
- offline tests for factory behavior

## Preserved Non-Goals

- no LLM answer generation
- no LLM reranking
- no UI changes
- no auth changes
- no unrelated ingestion changes
- no env or secret files
- no external API calls in tests
- no migrations
- no package changes
- no evidence policy changes

## Verification

Local verification passed:

- npm run typecheck
- npm run build
- npm run test

Test result:

- 111 tests
- 111 passing
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

## Next Recommended Feature

014-runtime-vector-wiring

Status: not started
