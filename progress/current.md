# Current Progress

## Active Feature

012-vector-query-integration

## State

spec_ready

## Summary

Feature 012 has been opened in SHIP mode as a specification-only change.

The goal is to define how hybrid retrieval obtains query embeddings and retrieves persisted vector candidates without weakening deterministic evidence-first answer behavior.

## Repository State

Local and GitHub were synchronized after 011 completion before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done

## Current Feature Scope

012 must define:

- query embedding provider boundary
- vector repository dependency wiring
- graceful degradation when vector dependencies are unavailable
- deterministic fake-provider tests
- vector candidate participation in hybrid ranking
- preservation of keyword, phrase, hybrid, answer, chat, and server behavior

## Non-Goals

012 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret changes
- external API calls in tests
- migrations unless separately approved

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 012-vector-query-integration for implementation in SHIP mode.`
