# Current Progress

## Active Feature

013-production-query-embedding-provider

## State

spec_ready

## Summary

Feature 013 has been opened in SHIP mode as a specification-only change.

The goal is to define a production query embedding provider behind the existing `QueryEmbeddingProvider` boundary without adding secrets, external calls in tests, or answer-policy drift.

## Repository State

Local and GitHub were synchronized after 012 completion before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done

## Current Feature Scope

013 must define:

- production query embedding provider adapter
- configuration-safe provider factory
- transport injection for deterministic tests
- stable provider error mapping
- dimension validation through the existing boundary
- no external provider calls in tests

## Non-Goals

013 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret files
- migrations
- package changes unless separately approved

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 013-production-query-embedding-provider for implementation in SHIP mode.`
