# Requirements: Vector Query Integration

Feature: 012-vector-query-integration  
Mode: SHIP  
Status: spec_ready

## Problem

Feature 011 added a production pgvector repository adapter and vector candidate mapping, but the live hybrid retrieval flow still does not obtain a query embedding or call the production vector repository.

As a result, `mode=hybrid` can combine phrase and keyword evidence, but it does not yet include persisted semantic vector candidates from `rag.embedding_vectors`.

## Goal

Define how the hybrid retrieval flow should obtain query embeddings and retrieve persisted vector candidates without weakening deterministic evidence-first answer behavior.

The feature must connect vector retrieval through explicit boundaries and preserve test safety.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions.
5. New ingestion formats.
6. New vector schema changes unless separately approved.
7. New provider secrets or env files.
8. External embedding provider calls in tests.
9. Changes to legal answer policy.

## Functional Requirements

### FR-1: Query Embedding Boundary

Hybrid retrieval must obtain query embeddings through an explicit provider boundary.

The implementation must not hard-code vendor calls inside `evidence.ts`.

### FR-2: Vector Retrieval Integration

Hybrid mode must be able to retrieve vector candidates from a `VectorRetrievalRepository` implementation.

The default production path may use `PgVectorEmbeddingRepository`, but tests must use deterministic fakes.

### FR-3: Graceful Degradation

If vector retrieval is not configured, hybrid mode must still work with phrase and keyword candidates.

The absence of a vector provider must not break keyword/phrase retrieval.

### FR-4: Evidence-First Preservation

Vector candidates are evidence candidates only if they are citable.

No citable evidence must still produce `not_found`.

### FR-5: Deterministic Testing

Tests must not call external embedding providers or databases unless explicitly guarded as integration tests.

### FR-6: Observability Metadata

Hybrid vector candidates should preserve metadata needed to understand source and score contribution.

At minimum, vector candidates should expose:

- chunk id
- citation label
- source type
- similarity score
- document title
- page/article coordinates when available

## Quality Requirements

### QR-1: Boundary Discipline

The query embedding provider, vector repository, and evidence layer must remain separated.

### QR-2: Backward Compatibility

Existing keyword, phrase, hybrid, answer, chat, and server tests must keep passing.

### QR-3: No Runtime Secret Assumptions

This feature must not add required env vars unless separately approved.

### QR-4: No Policy Drift

Answer behavior must remain deterministic and evidence-first.

## Acceptance Criteria

The feature can move to review when:

1. Query embedding has an explicit boundary.
2. Hybrid retrieval can include vector candidates through a repository boundary.
3. The system degrades gracefully when vector retrieval is unavailable.
4. Tests prove phrase and keyword behavior remain unchanged.
5. Tests prove hybrid can include vector candidates with deterministic fakes.
6. Tests prove no evidence still returns `not_found`.
7. No external API calls occur in tests.
8. No LLM calls are introduced.
9. `npm run typecheck` passes.
10. `npm run build` passes.
11. `npm run test` passes.
