# Requirements: Runtime Vector Observability

Feature: 015-runtime-vector-observability  
Mode: SHIP  
Status: spec_ready

## Problem

Feature 014 wires runtime vector dependencies into the server, but operators cannot safely inspect whether the vector runtime path is enabled, disabled, or degraded.

Without a safe status surface, misconfiguration can look like normal fallback behavior, which makes production diagnosis harder.

## Goal

Define safe runtime vector observability for the vector retrieval path.

The system should expose or provide a sanitized status model indicating whether vector runtime is:

- enabled
- disabled
- degraded

The status must not reveal secrets, tokens, raw endpoint values, or sensitive database details.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions changes.
5. New ingestion formats.
6. New migrations.
7. Package changes.
8. Secrets or env files.
9. Hosted provider calls in tests.
10. Runtime health checks that call external embedding providers.
11. Legal answer policy changes.

## Functional Requirements

### FR-1: Status Model

The implementation must define a stable runtime vector status model.

The model must distinguish at least:

- `enabled`
- `disabled`
- `degraded`

### FR-2: Safe Reasons

The status must include safe reason codes.

Examples:

- `missing_query_embedding_config`
- `missing_database_config`
- `runtime_dependencies_ready`
- `partial_runtime_dependencies`

Reason codes must not contain secret values.

### FR-3: Runtime Factory Metadata

The runtime dependency factory should be able to report status metadata without requiring external network calls.

### FR-4: Server Exposure

The server may expose sanitized vector runtime status through an internal-safe route or through `/health` metadata.

Any exposure must avoid secrets, raw API keys, raw provider URLs, and database connection strings.

### FR-5: No External Calls

Status evaluation must not call hosted providers.

Status should be based on configuration completeness and local dependency construction only.

### FR-6: Test Coverage

Tests must cover:

- disabled due to missing query embedding configuration
- disabled due to missing database configuration
- enabled when runtime dependencies are complete
- no secret leakage in the public status object

## Quality Requirements

### QR-1: Backward Compatibility

Existing server routes must remain stable.

### QR-2: Security

Status output must not leak:

- API keys
- authorization headers
- database URLs
- raw endpoint URLs
- tokens

### QR-3: Determinism

Tests must be offline and deterministic.

### QR-4: Operational Usefulness

The status should be clear enough for an operator to distinguish normal fallback from misconfiguration.

## Acceptance Criteria

The feature can move to review when:

1. A runtime vector status model exists.
2. Runtime dependency construction can return sanitized status metadata.
3. The server exposes or can report the sanitized status.
4. Missing config states are covered by tests.
5. Complete config state is covered by tests.
6. Secret leakage prevention is covered by tests.
7. No external provider calls occur in tests.
8. `npm run typecheck` passes.
9. `npm run build` passes.
10. `npm run test` passes.
