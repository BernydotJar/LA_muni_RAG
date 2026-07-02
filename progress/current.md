# Current Progress

## Active Feature

009-hybrid-retrieval-ranking

## State

spec_ready

## Summary

Feature 009 has been opened in SHIP mode as a specification-only change.

The goal is to define hybrid retrieval ranking for LA_muni_RAG by combining phrase, keyword, and vector candidates while preserving the deterministic evidence-first answer policy.

## Repository Sync

Local repository and GitHub were mirrored through Feature 008 before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done

## Current Feature Scope

009 must define:

- hybrid candidate types
- phrase/keyword/vector score composition
- deterministic deduplication
- phrase priority
- vector retrieval boundary
- evidence compatibility

## Non-Goals

009 must not introduce:

- LLM answer generation
- UI changes
- auth changes
- ingestion extractor changes
- external API calls in tests
- unsupported legal conclusions

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 009-hybrid-retrieval-ranking for implementation in SHIP mode.`
