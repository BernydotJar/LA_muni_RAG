# 008 Embedding Indexing Pipeline Design

Status: Implemented

## Design Principle

Embeddings are an index, not a source of truth. The source of truth remains the
normalized section text and its citation metadata.

For a municipal/legal RAG system, the embedding pipeline must be:

- idempotent
- auditable
- citation-preserving
- provider-agnostic
- safe to retry

## Proposed Flow

```text
NormalizedDocument
  -> NormalizedSection[]
  -> chunk planner
  -> deterministic chunk ids
  -> embedding job queue
  -> embedding provider
  -> pgvector rows
  -> validation queries
```

## Proposed Module Layout

```text
src/embeddings/
  types.ts
  chunkPlanner.ts
  chunkIdentity.ts
  provider.ts
  indexer.ts
  repository.ts
  validation.ts

src/__tests__/
  embeddings-chunk-planner.test.ts
  embeddings-chunk-identity.test.ts
  embeddings-indexer.test.ts
```

## Data Contract

Each indexed chunk should retain:

- source document title
- source format
- section path
- section type
- page start/page end when available
- article number when available
- citation label
- normalized text
- content hash
- embedding model
- embedding dimension
- embedding provider
- indexed timestamp
- retry/failure metadata when applicable

## Idempotency

Chunk identity should be derived from stable inputs:

```text
document id or stable document key
document version
section path
page/article coordinates
content hash
chunk ordinal
```

Re-indexing unchanged content should not create duplicate vector rows.

## Provider Boundary

The embedding provider should be an interface. Implementation can later use an
external service, but this spec phase does not call any provider.

```text
EmbeddingProvider
  model
  dimensions
  embed(texts: string[]) -> vectors
```

## Failure Handling

Implementation should distinguish:

- invalid input
- provider failure
- database write failure
- dimension mismatch
- partial batch failure

Retries must be safe and must not duplicate indexed chunks.

## Retrieval Boundary

Vector retrieval must not replace keyword/phrase retrieval until a later feature
adds tests, evaluation, and API behavior gates.

## Deferred Work

- Actual provider integration.
- Database migration for embedding jobs/vector rows.
- Hybrid retrieval.
- `/api/vector-search`.
- Agent use of vector retrieval.
