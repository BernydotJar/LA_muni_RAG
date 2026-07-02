# Current Progress

## Active Feature

010-hybrid-retrieval-integration

## State

spec_ready

## Summary

Feature 010 has been opened in SHIP mode as a specification-only change.

The goal is to define controlled integration of the hybrid retrieval layer into the evidence/search flow while preserving deterministic evidence-first answer behavior.

## Repository State

Local and GitHub were synchronized after 009 completion before opening this feature.

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done

## Current Feature Scope

010 must define:

- hybrid evidence mode or approved integration boundary
- mapping from keyword and phrase search results into hybrid candidates
- citation-preserving evidence mapping
- API mode validation if hybrid becomes public
- tests proving existing keyword and phrase behavior remain unchanged
- tests proving deterministic answer policy remains unchanged

## Non-Goals

010 must not introduce:

- LLM answer generation
- LLM reranking
- UI changes
- auth changes
- ingestion extractor changes
- package changes
- env or secret changes
- migrations without separate approval
- external API calls in tests

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 010-hybrid-retrieval-integration for implementation in SHIP mode.`
