# Current Progress

## Active Feature

014-runtime-vector-wiring

## State

review

## Summary

Feature 014 has been implemented in SHIP mode.

The implementation adds runtime composition for query embedding provider, pgvector repository, and hybrid evidence dependencies. Server evidence, search, agent, answer, and chat routes now use dependency-aware retrieval while preserving safe fallback when vector configuration is missing.

## Completed Implementation

014 added:

- `createRuntimeEvidenceDependencies()`
- safe query embedding provider construction at runtime
- safe pgvector repository construction at runtime
- server wiring through `findEvidenceWithDependencies()`
- dependency-aware agent evaluation
- dependency-aware deterministic answer generation
- dependency-aware chat processing
- offline tests for runtime dependency construction

## Preserved Non-Goals

014 did not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret files
- external provider calls in tests
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

- missing query embedding config returns empty runtime dependencies
- missing database config returns empty runtime dependencies
- server routes remain stable without vector config
- hybrid routes can receive runtime vector dependencies when config is complete
- no secrets were committed
- tests do not call hosted providers

## Next Gate

Run local verification and review the implementation before moving 014 to done.
