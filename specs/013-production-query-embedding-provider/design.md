# Design: Production Query Embedding Provider

Feature: 013-production-query-embedding-provider  
Mode: SHIP

## Overview

Feature 012 created a query embedding boundary and made hybrid evidence capable of consuming vector candidates when dependencies are provided.

Feature 013 defines the production adapter behind that boundary.

## Current State

The repository has:

- `QueryEmbeddingProvider`
- query embedding dimension validation
- optional vector repository wiring in hybrid evidence
- pgvector repository support for vector search

The missing piece is a production provider that can produce query embeddings at runtime without coupling evidence code to a vendor.

## Target State

The target runtime path is:

1. application configuration is read
2. a provider factory decides whether a query embedding provider can be created
3. hybrid evidence receives the provider through dependency injection
4. query embeddings are generated through the provider boundary
5. vector search receives the query vector
6. deterministic evidence policy remains unchanged

## Provider Direction

The first production adapter should be HTTP-transport based and dependency-injected.

This keeps the adapter testable without adding a provider SDK dependency.

A minimal adapter should support:

- API key supplied at runtime
- model name
- expected vector dimensions
- endpoint URL
- injected fetch-compatible transport

## Configuration Direction

A small config loader may read environment variables, but must not throw during import.

Recommended documented names:

- `QUERY_EMBEDDING_PROVIDER`
- `QUERY_EMBEDDING_MODEL`
- `QUERY_EMBEDDING_DIMENSIONS`
- `QUERY_EMBEDDING_ENDPOINT`
- `QUERY_EMBEDDING_API_KEY`

The feature should not commit `.env` values.

## Test Strategy

Tests should use local fake transport functions.

Tests should cover:

- successful provider response mapping
- wrong dimension response
- provider HTTP failure
- missing configuration disables provider construction
- no external calls

## Boundary Rule

`evidence.ts` must not import the production provider.

Runtime composition should happen in a factory or application wiring layer.

## API Behavior

Public API behavior should remain stable unless the runtime composition layer explicitly enables query vector search.

This feature should not change answer generation behavior.

## Explicit Constraints

This feature must not:

- commit secrets
- add LLM generation
- add LLM reranking
- change UI
- change migrations
- require provider calls in tests
