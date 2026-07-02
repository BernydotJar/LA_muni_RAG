# Current Progress

## Active Feature

014-runtime-vector-wiring

## State

spec_ready

## Summary

Feature 014 has been opened in SHIP mode as a specification-only change.

The goal is to define runtime composition for the query embedding provider, pgvector repository, and hybrid evidence dependencies with safe fallback.

## Repository State

Local and GitHub were synchronized after 013 completion before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done
- 013-production-query-embedding-provider: done

## Current Feature Scope

014 must define:

- runtime evidence dependency factory
- safe query embedding provider construction
- safe vector repository construction
- server wiring through dependency-aware evidence retrieval
- fallback behavior when vector config is missing
- offline tests without hosted provider calls

## Non-Goals

014 must not introduce:

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

`Approved: 014-runtime-vector-wiring for implementation in SHIP mode.`
