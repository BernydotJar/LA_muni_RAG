# Requirements: Hybrid Retrieval Ranking

Feature: 009-hybrid-retrieval-ranking  
Mode: SHIP  
Status: spec_ready

## Problem

LA_muni_RAG currently supports deterministic keyword and phrase retrieval, plus an embedding indexing foundation. However, retrieval does not yet combine lexical search, exact phrase search, and vector similarity into a single ranked evidence set.

Without hybrid retrieval, the system can miss relevant municipal/legal evidence when the user's wording does not match the document text exactly.

## Goal

Implement a hybrid retrieval ranking design that combines:

- exact phrase matches
- keyword/full-text matches
- vector similarity candidates

while preserving the existing evidence-first answer policy.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. Changes to answer policy.
3. UI redesign.
4. Auth or permissions.
5. New document ingestion formats.
6. New corpus documents.
7. Database migrations unless explicitly approved.
8. External API calls in tests.
9. Reranking with an LLM.

## Functional Requirements

### FR-1: Hybrid Candidate Model

The system must define a common candidate shape for phrase, keyword, and vector search results.

Each candidate must preserve:

- source mode
- document identity when available
- section/chunk identity when available
- citation label
- excerpt/text
- page/article coordinates when available
- score components
- final hybrid score

### FR-2: Ranking Composition

The system must define deterministic hybrid scoring.

The ranking must account for:

- exact phrase match strength
- keyword/full-text score
- vector similarity score
- citation/provenance completeness
- source type where useful

### FR-3: Exact Evidence Priority

Exact phrase matches must not be buried by weaker semantic results.

When phrase matches exist, they should receive a strong ranking boost.

### FR-4: Vector Retrieval Boundary

The feature may add vector retrieval through an interface or repository boundary.

Tests must use deterministic/local vector data and must not require external embedding APIs.

### FR-5: Evidence Compatibility

Hybrid retrieval results must remain compatible with the existing evidence layer.

The output must still support:

- evidence_found
- insufficient_evidence
- not_found
- citations
- deterministic answer behavior

### FR-6: No Answer Policy Drift

The existing `/api/answer` behavior must remain evidence-first.

No evidence must still mean no answer.

## Quality Requirements

### QR-1: Deterministic Tests

All tests must be deterministic and offline.

### QR-2: Citation Integrity

Hybrid retrieval must not return uncitable evidence.

### QR-3: No Silent Behavior Expansion

The feature must not introduce LLM reasoning or unsupported legal conclusions.

### QR-4: Backward Compatibility

Existing keyword, phrase, evidence, answer, chat, and server tests must continue passing.

## Acceptance Criteria

The feature can move to review when:

1. Hybrid candidate types exist.
2. Hybrid ranking logic exists.
3. Phrase/keyword/vector candidates can be merged.
4. Duplicate candidates are deduplicated deterministically.
5. Exact phrase matches are prioritized appropriately.
6. Vector candidates are supported through a test-safe interface.
7. Existing evidence and answer contracts remain compatible.
8. No LLM calls are introduced.
9. No external API calls are required in tests.
10. `npm run typecheck` passes.
11. `npm run build` passes.
12. `npm run test` passes.
