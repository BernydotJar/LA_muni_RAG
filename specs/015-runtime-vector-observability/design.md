# Design: Runtime Vector Observability

Feature: 015-runtime-vector-observability  
Mode: SHIP

## Overview

Feature 015 adds a sanitized observability layer for the runtime vector path.

Feature 014 already composes:

- query embedding provider
- pgvector repository
- dependency-aware evidence retrieval

Feature 015 should make the runtime state visible without exposing secrets or requiring network calls.

## Proposed Status Model

Recommended type:

```text
RuntimeVectorStatus
```

Recommended fields:

```text
state: enabled | disabled | degraded
reasons: string[]
queryEmbeddingProviderConfigured: boolean
vectorRepositoryConfigured: boolean
```

Optional safe fields:

```text
providerName
model
expectedDimensions
```

Do not include:

```text
apiKey
endpoint
authorization headers
DATABASE_URL
connection string
raw error objects
```

## Runtime Factory Direction

Feature 014 currently exposes:

```text
createRuntimeEvidenceDependencies()
```

Feature 015 may add:

```text
createRuntimeEvidenceDependencyContext()
```

or extend the factory with a context return object such as:

```text
{
  dependencies,
  vectorStatus
}
```

The existing `createRuntimeEvidenceDependencies()` API should remain available for backward compatibility.

## State Rules

Recommended rules:

```text
enabled:
  query embedding provider is configured
  vector repository is configured

disabled:
  neither vector dependency can be safely created
  or required configuration is missing

degraded:
  partial configuration exists
  or only one side of the vector path can be created
```

The implementation should prefer conservative status.

## Server Exposure Direction

Preferred minimal exposure:

```text
GET /health
```

Add a sanitized nested object:

```text
vectorRuntime: {
  state,
  reasons,
  queryEmbeddingProviderConfigured,
  vectorRepositoryConfigured
}
```

This keeps the API small and operationally useful.

## Test Strategy

Tests should cover:

- no config -> disabled
- embedding config without database config -> degraded or disabled, depending on final rule
- complete config -> enabled
- public health output contains no secret values
- no hosted provider calls

## Boundary Rule

Observability must not alter retrieval ranking, answer policy, evidence mapping, or public legal answer semantics.

## Explicit Constraints

This feature must not:

- call hosted providers for health/status
- expose secrets
- add packages
- add migrations
- add UI
- add LLM generation
- alter evidence policy
