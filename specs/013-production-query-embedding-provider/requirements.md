# Requirements: Production Query Embedding Provider

Feature: 013-production-query-embedding-provider  
Mode: SHIP  
Status: spec_ready

## Problem

Feature 012 added the `QueryEmbeddingProvider` boundary and optional vector repository wiring, but no production provider exists behind that boundary.

Hybrid retrieval can now include vector candidates when a query embedding provider and vector repository are supplied, but the repository does not yet include a safe production adapter for creating query embeddings.

## Goal

Define a production query embedding provider behind the existing `QueryEmbeddingProvider` boundary.

The provider must be isolated, configurable, testable offline, and must not change deterministic answer behavior.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions.
5. New ingestion formats.
6. New vector schema changes.
7. Secrets committed to the repository.
8. External provider calls in tests.
9. Automatic provider activation without explicit runtime configuration.
10. Legal interpretation or answer expansion.

## Functional Requirements

### FR-1: Provider Adapter

The implementation must define a production adapter that implements `QueryEmbeddingProvider`.

The adapter must be isolated from `evidence.ts`.

### FR-2: Configuration Boundary

Provider configuration must be read through a small boundary.

The repository must not commit secrets or require `.env` changes in tests.

### FR-3: Dimension Safety

The adapter must expose its configured dimension and rely on existing query embedding dimension validation.

### FR-4: Runtime Construction

The implementation may add a factory that constructs the provider only when the required configuration is present.

If configuration is missing, the factory should return no provider or a disabled state, not throw during module import.

### FR-5: Test Safety

All tests must remain deterministic and offline.

Provider HTTP behavior should be tested through injected fake fetch functions or equivalent local test doubles.

### FR-6: Error Handling

Provider failures must be converted into stable `QueryEmbeddingError` errors or equivalent typed failures.

Hybrid evidence must continue to degrade safely through the existing Feature 012 behavior.

## Quality Requirements

### QR-1: Boundary Discipline

`evidence.ts` must not import vendor-specific provider code.

### QR-2: No Secret Leakage

No API keys, tokens, or secret placeholders should be committed beyond documented environment variable names.

### QR-3: Backward Compatibility

Existing keyword, phrase, hybrid, answer, chat, and server tests must keep passing.

### QR-4: No External Calls In Tests

Tests must not call hosted embedding services.

## Acceptance Criteria

The feature can move to review when:

1. A production query embedding provider adapter exists.
2. Provider construction is explicit and configuration-safe.
3. Missing configuration does not crash import or test execution.
4. Provider response mapping is tested with deterministic fake transport.
5. Provider failure mapping is tested.
6. No external provider calls occur in tests.
7. No LLM calls are introduced.
8. `npm run typecheck` passes.
9. `npm run build` passes.
10. `npm run test` passes.
