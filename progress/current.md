# Current Progress

## Active Feature

021-retrieval-eval-harness

## State

spec_ready

## Summary

Feature 021 has been opened in SHIP mode as a specification-only change.

The goal is to add an offline retrieval evaluation harness that makes retrieval quality measurable and repeatable without requiring a database, hosted provider, network, secrets, LLM judge, or production corpus.

## Product Direction

The harness should evaluate retrieval output, not answer generation.

It should support:

- golden query cases
- expected evidence checks
- expected `not_found` checks
- stable failure reasons
- aggregate metrics
- deterministic text report formatting
- offline tests

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
- 019-rag-glass-wall-easter-egg: done
- 020-corpus-backfill-cli: done

## Current Feature Scope

021 must define and then implement, after approval:

- retrieval eval case model
- expected evidence matcher
- expected not_found checks
- eval runner
- metrics aggregation
- stable text report formatter
- minimal synthetic eval cases
- offline tests

## Non-Goals

021 must not introduce:

- LLM judge
- hosted provider calls
- database calls in tests
- new package dependency
- new server route
- UI changes
- production scheduler
- corpus backfill changes
- retrieval ranking changes
- evidence policy changes
- answer generation changes
- auth changes
- CI threshold gate unless separately approved
- large benchmark corpus

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 021-retrieval-eval-harness for implementation in SHIP mode.`
