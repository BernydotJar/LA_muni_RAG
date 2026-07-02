# Current Progress

## Active Feature

015-runtime-vector-observability

## State

spec_ready

## Summary

Feature 015 has been opened in SHIP mode as a specification-only change.

The goal is to define safe runtime vector observability for enabled, disabled, and degraded states without exposing secrets or changing answer policy.

## Repository State

Local and GitHub were synchronized after 014 completion before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done
- 013-production-query-embedding-provider: done
- 014-runtime-vector-wiring: done

## Current Feature Scope

015 must define:

- runtime vector status model
- safe reason codes
- context factory with dependencies and status
- sanitized server exposure
- secret leakage prevention tests
- offline tests without hosted provider calls

## Non-Goals

015 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- unrelated ingestion changes
- env or secret files
- migrations
- package changes unless separately approved
- hosted provider health checks

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 015-runtime-vector-observability for implementation in SHIP mode.`
