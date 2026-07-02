# Current Progress

## Active Feature

011-production-vector-store

## State

review

## Summary

Feature 011 has been implemented in SHIP mode.

The implementation adds a production pgvector storage schema, a repository adapter behind the existing embedding/vector retrieval boundaries, deterministic vector mapping helpers, dimension validation, and offline tests.

## Completed Implementation

011 added:

- production pgvector migration for `rag.embedding_vectors`
- `PgVectorEmbeddingRepository`
- mapping from `EmbeddingVectorRecord` to pgvector upsert values
- mapping from pgvector result rows to `VectorCandidateInput`
- vector literal formatting
- vector dimension validation
- citation-label rejection at write/search mapping boundaries
- offline unit tests for mapping and validation

## Preserved Non-Goals

011 did not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret changes
- external API calls in tests

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- migration is acceptable for the target PostgreSQL/pgvector environment
- fixed vector dimension is correct for the selected production embedding model
- repository adapter remains behind boundaries
- citation labels are required
- dimension mismatch fails predictably
- no external provider calls are used in tests

## Next Gate

Run local verification and review the implementation before moving 011 to done.
