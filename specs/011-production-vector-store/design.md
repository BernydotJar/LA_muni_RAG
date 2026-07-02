# Design: Production Vector Store

Feature: 011-production-vector-store  
Mode: SHIP

## Overview

The current system has:

```text
008 embedding indexing pipeline
009 hybrid retrieval ranking
010 hybrid evidence integration
```

Feature 011 defines the production vector persistence layer so semantic candidates can be retrieved from persisted indexed chunks.

## Current State

Embedding records exist as in-memory/test-safe records through the embedding repository boundary.

Hybrid retrieval accepts vector candidates through the `VectorRetrievalRepository` interface.

The production gap is persistence and retrieval of vectors from a real store.

## Target State

The target vector path is:

```text
NormalizedDocument
  -> embedding chunks
  -> embedding provider
  -> production vector repository
  -> vector similarity search
  -> VectorCandidateInput[]
  -> hybrid retrieval
  -> evidence
  -> deterministic answer policy
```

## Preferred Storage Direction

Because the project already uses PostgreSQL, the preferred production direction is PostgreSQL with pgvector, unless later constraints force an external vector service.

A proposed table shape:

```sql
CREATE TABLE rag.embedding_vectors (
  chunk_id text PRIMARY KEY,
  document_key text NOT NULL,
  document_version text NOT NULL,
  document_title text NOT NULL,
  citation_label text NOT NULL,
  page_start integer,
  page_end integer,
  article_number text,
  source_type text,
  section_path jsonb NOT NULL DEFAULT '[]'::jsonb,
  chunk_ordinal integer NOT NULL,
  chunk_text text NOT NULL,
  content_sha256 text NOT NULL,
  embedding_model text NOT NULL,
  embedding_provider text NOT NULL,
  embedding_dimension integer NOT NULL,
  embedding vector,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  indexed_at timestamptz NOT NULL DEFAULT now()
);
```

The final implementation may choose a fixed pgvector dimension if required by PostgreSQL/pgvector constraints.

## Repository Boundary

Runtime integration should use a repository adapter, not inline SQL in the evidence layer.

Potential files:

```text
src/embeddings/pgVectorRepository.ts
src/retrieval/pgVectorRetriever.ts
```

## Search Behavior

Vector search should:

1. receive a query embedding
2. validate the dimension
3. query nearest persisted chunks
4. filter uncitable records
5. return `VectorCandidateInput[]`

## Dimension Safety

Dimension mismatch should fail before issuing an invalid vector query.

The error should be stable and testable.

## Citation Integrity

The write boundary should reject chunks without citation labels.

The search boundary should also filter or reject records without citation labels.

## Migration Strategy

If implementation adds a migration, it should be isolated and named for this feature.

The migration must not alter existing retrieval tables except where explicitly necessary.

## Testing Strategy

Tests should cover:

- record mapping from `EmbeddingVectorRecord` to persisted row shape
- idempotent upsert behavior
- vector result mapping to `VectorCandidateInput`
- citation filtering
- dimension validation
- no external provider calls

Database-backed integration tests may be guarded by `DATABASE_URL` and skipped when unavailable.

## Explicit Constraints

This feature must not:

- introduce LLM answer generation
- introduce LLM reranking
- change UI
- change answer policy
- call external embedding providers in tests
- replace keyword or phrase retrieval
