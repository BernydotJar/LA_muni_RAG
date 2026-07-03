# Current Progress

## Active Feature

019-rag-glass-wall-easter-egg

## State

spec_ready

## Summary

Feature 019 has been opened in SHIP mode as a specification-only change.

The goal is to define a CTO/operator-facing RAG Glass Wall easter egg: a safe visual transparency surface for query flow, retrieval paths, evidence candidates, citation readiness, answer status, and sanitized runtime state.

## Product Direction

This feature should feel like a glass wall into the RAG system: visually inspired by a neural-network signal graph, but grounded in observable system behavior rather than hidden model reasoning.

It must not expose secrets, prompts, provider keys, database URLs, chain-of-thought, or raw hidden model messages.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done
- 013-production-query-embedding-provider: done
- 014-runtime-vector-wiring: done
- 015-runtime-vector-observability: done
- 016-ingestion-cli-vector-indexing: done
- 017-corpus-backfill-manifest: done
- 018-file-backed-corpus-manifest: done

## Current Feature Scope

019 must define:

- direct-url glass wall view
- query input
- visual layers for query, retrieval modes, evidence candidates, and final answer state
- active/muted path highlighting
- integration with existing safe endpoints only
- degraded/not_found/error states
- static safety validation if implemented

## Non-Goals

019 must not introduce:

- chain-of-thought exposure
- prompt leakage
- secrets display
- provider key display
- database URL display
- LLM answer generation changes
- LLM reranking
- retrieval ranking changes
- auth changes
- migrations
- package changes
- server routes unless separately approved

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 019-rag-glass-wall-easter-egg for implementation in SHIP mode.`
