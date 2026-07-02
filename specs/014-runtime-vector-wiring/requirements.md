# Requirements: Runtime Vector Wiring

Feature: 014-runtime-vector-wiring  
Mode: SHIP  
Status: spec_ready

## Problem

The repository now has separate foundations for production vector retrieval:

- production pgvector repository
- query embedding provider boundary
- HTTP query embedding provider
- hybrid evidence dependency injection

However, runtime code does not yet compose these pieces into the server flow.

As a result, `mode=hybrid` can consume vector dependencies when explicitly provided, but the API does not yet construct and pass those dependencies at runtime.

## Goal

Define runtime composition for query embedding provider, pgvector repository, and hybrid evidence dependencies with safe fallback.

When configuration is complete, hybrid API requests should be able to use persisted vector search. When configuration is incomplete or vector dependencies fail, keyword and phrase retrieval must continue to work.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions.
5. New ingestion formats.
6. New migrations.
7. Package changes.
8. Secrets or env files.
9. Hosted provider calls in tests.
10. Legal answer policy changes.

## Functional Requirements

### FR-1: Runtime Dependency Factory

The implementation must define a runtime dependency factory for evidence retrieval.

The factory should construct vector dependencies only when configuration is complete.

### FR-2: Server Integration

The server should use dependency-aware evidence retrieval where appropriate.

Existing keyword and phrase behavior must remain unchanged.

### FR-3: Safe Fallback

If query embedding provider configuration is missing, hybrid mode must still work using phrase and keyword candidates.

If vector repository configuration is missing, hybrid mode must still work using phrase and keyword candidates.

### FR-4: No Import-Time Failure

Missing environment variables must not crash module import or server startup.

### FR-5: Test Safety

Tests must remain deterministic.

No tests should call hosted embedding providers.

No tests should require production vector database access unless explicitly isolated as integration tests.

### FR-6: Boundary Preservation

`evidence.ts` should remain dependency-driven and vendor-agnostic.

Server/runtime composition may import provider and repository factories.

## Quality Requirements

### QR-1: Backward Compatibility

Existing API routes and response structures must remain stable.

### QR-2: No Secret Leakage

No secrets, tokens, or `.env` values may be committed.

### QR-3: Explicit Activation

Vector runtime activation must require explicit configuration.

### QR-4: Observability Readiness

The design should make it possible to inspect whether vector runtime dependencies are enabled, but this feature does not need a new public endpoint.

## Acceptance Criteria

The feature can move to review when:

1. Runtime evidence dependency factory exists.
2. The server can use dependency-aware evidence retrieval.
3. Missing vector configuration does not crash startup or tests.
4. Hybrid fallback behavior is preserved.
5. Tests prove default server behavior remains stable without vector config.
6. Tests prove dependency factory creates vector dependencies only when config is complete.
7. No hosted provider calls occur in tests.
8. `npm run typecheck` passes.
9. `npm run build` passes.
10. `npm run test` passes.
