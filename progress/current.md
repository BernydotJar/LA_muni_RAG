# Current Progress

## Active Feature

None.

## Last Completed Feature

014-runtime-vector-wiring

## State

done

## Summary

Feature 014 has been completed in SHIP mode.

The implementation adds runtime composition for query embedding provider, pgvector repository, and hybrid evidence dependencies. Server evidence, search, agent, answer, and chat routes now use dependency-aware retrieval while preserving safe fallback when vector configuration is missing.

## Completed Implementation

- `createRuntimeEvidenceDependencies()`
- safe query embedding provider construction at runtime
- safe pgvector repository construction at runtime
- server wiring through `findEvidenceWithDependencies()`
- dependency-aware agent evaluation
- dependency-aware deterministic answer generation
- dependency-aware chat processing
- offline tests for runtime dependency construction

## Preserved Non-Goals

- no LLM answer generation
- no LLM reranking
- no UI changes
- no auth changes
- no unrelated ingestion changes
- no env or secret files
- no external provider calls in tests
- no migrations
- no package changes
- no evidence policy changes

## Verification

Local verification passed:

- npm run typecheck
- npm run build
- npm run test

Test result:

- 114 tests
- 114 passing
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

## Next Recommended Feature

015-runtime-vector-observability

Status: not started
