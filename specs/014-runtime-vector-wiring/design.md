# Design: Runtime Vector Wiring

Feature: 014-runtime-vector-wiring  
Mode: SHIP

## Overview

Feature 014 defines the runtime composition layer that connects the existing vector components into API execution.

The relevant components already exist:

- `findEvidenceWithDependencies()`
- `createQueryEmbeddingProvider()`
- `PgVectorEmbeddingRepository`
- `VectorRetrievalRepository`
- hybrid retrieval ranking

## Current State

Hybrid evidence can use vector candidates when dependencies are supplied directly.

The API server currently calls evidence functions without constructing production vector dependencies.

## Target State

At runtime, the server can obtain an evidence dependency object from a factory.

The factory should:

1. read query embedding configuration
2. create query embedding provider only when config is complete
3. create pgvector repository only when database/vector configuration is complete
4. return an evidence dependency object
5. return an empty or partial dependency object when config is incomplete

Hybrid retrieval then uses existing graceful degradation.

## Proposed Boundary

Add a runtime module such as:

```text
src/runtime/evidenceDependencies.ts
```

This module can expose:

```text
createEvidenceDependencies(options?)
```

The function should return an `EvidenceDependencies` object.

## Configuration Direction

The query embedding provider factory already reads:

- `QUERY_EMBEDDING_PROVIDER`
- `QUERY_EMBEDDING_ENDPOINT`
- `QUERY_EMBEDDING_API_KEY`
- `QUERY_EMBEDDING_MODEL`
- `QUERY_EMBEDDING_DIMENSIONS`

The pgvector repository should only be constructed when database configuration is available through existing database config paths.

This feature should not add `.env` files.

## Server Wiring Direction

Server routes that call evidence retrieval should use dependency-aware retrieval.

Expected direction:

- keep request validation unchanged
- keep response schemas unchanged
- call `findEvidenceWithDependencies()` with runtime dependencies
- preserve keyword and phrase modes
- preserve fallback behavior when dependencies are empty

## Test Strategy

Tests should cover:

- factory returns empty dependencies when config is missing
- factory can return provider and vector repository when config is complete using fake construction inputs where possible
- server routes still pass without vector config
- no hosted provider calls occur

## Boundary Rule

`evidence.ts` should remain vendor-agnostic.

Runtime composition may import provider and repository adapters.

## Explicit Constraints

This feature must not:

- commit secrets
- add package dependencies
- add migrations
- add LLM generation
- add LLM reranking
- change public UI
- require hosted provider calls in tests
