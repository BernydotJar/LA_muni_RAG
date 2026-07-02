# Current Progress

## Active Feature

013-production-query-embedding-provider

## State

review

## Summary

Feature 013 has been implemented in SHIP mode.

The implementation adds an HTTP query embedding provider behind the existing `QueryEmbeddingProvider` boundary, plus a configuration-safe factory and offline tests using injected transport.

## Completed Implementation

013 added:

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

013 did not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret files
- external API calls in tests
- migrations
- package changes
- evidence policy changes

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- provider construction returns null when configuration is missing
- tests do not call hosted providers
- no secrets were committed
- `evidence.ts` remains vendor-agnostic
- provider failures use stable `QueryEmbeddingError` values
- dimension mismatch is still rejected

## Next Gate

Run local verification and review the implementation before moving 013 to done.
