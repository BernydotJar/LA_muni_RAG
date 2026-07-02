# Design: Vector Query Integration

Feature: 012-vector-query-integration  
Mode: SHIP

## Overview

The system now has an embedding pipeline, hybrid ranking, hybrid evidence integration, and a production pgvector repository.

Feature 012 defines how query-time semantic retrieval joins the hybrid evidence flow.

## Current State

`mode=hybrid` currently combines phrase and keyword candidates.

Vector candidates are supported by the hybrid ranking layer but are not yet produced by the live evidence flow.

`PgVectorEmbeddingRepository` can search persisted vectors when it receives a query vector.

The missing piece is query vector production and dependency wiring.

## Target State

The target hybrid query path is:

1. receive query text
2. run phrase search
3. run keyword search
4. obtain a query vector through an explicit boundary
5. search persisted vectors through a repository boundary
6. combine all candidates through the hybrid ranking layer
7. return citable evidence
8. preserve deterministic answer policy

## Boundary Design

The query embedding dependency should be explicit.

A provider boundary should expose:

- provider name
- model name
- vector dimension
- a method that converts query text into one vector

Runtime code should receive this dependency explicitly rather than constructing vendor clients inside the evidence layer.

## Graceful Degradation

Hybrid retrieval should support three states:

1. vector provider and repository available: phrase, keyword, and vector candidates
2. vector provider unavailable: phrase and keyword candidates only
3. vector provider fails predictably: phrase and keyword candidates only

The feature must not weaken existing phrase or keyword behavior.

## Test Strategy

Tests should use deterministic fake providers and fake repositories.

No tests should call external APIs.

No tests should require production database access unless they are explicitly guarded as integration tests.

## Evidence Mapping

Vector results should flow through the existing mapping path:

- vector candidate input
- hybrid candidate
- evidence item

This preserves ranking and citation filtering from the existing retrieval components.

## API Behavior

Public API behavior should remain stable:

- `mode=keyword` unchanged
- `mode=phrase` unchanged
- `mode=hybrid` returns hybrid evidence
- invalid mode still returns 400
- no evidence still returns deterministic `not_found`

## Explicit Constraints

This feature must not:

- add provider secrets
- require external embedding calls in tests
- change answer generation
- add LLM reranking
- change UI
- change migration or schema unless separately approved
