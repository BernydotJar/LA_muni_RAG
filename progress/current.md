# Current Progress

## Active Feature

012-vector-query-integration

## State

review

## Summary

Feature 012 has been implemented in SHIP mode.

The implementation adds a query embedding boundary and optional vector repository wiring so hybrid evidence can include semantic vector candidates when dependencies are provided, while degrading safely to phrase and keyword retrieval when vector dependencies are absent or fail.

## Completed Implementation

012 added:

- `QueryEmbeddingProvider` boundary
- query embedding dimension validation
- `findEvidenceWithDependencies()` for explicit dependency injection
- optional vector candidate retrieval in hybrid mode
- graceful degradation when vector dependencies are missing
- graceful degradation when query embedding fails
- offline tests for query embedding boundary
- offline tests for hybrid vector integration with deterministic fakes

## Preserved Non-Goals

012 did not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret changes
- external API calls in tests
- migrations
- package changes

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- keyword and phrase modes remain independent from vector dependencies
- hybrid mode can include vector candidates when dependencies are provided
- hybrid mode degrades safely without vector dependencies
- vector candidates still require citation labels
- no external provider calls are used in tests
- deterministic answer policy remains unchanged

## Next Gate

Run local verification and review the implementation before moving 012 to done.
