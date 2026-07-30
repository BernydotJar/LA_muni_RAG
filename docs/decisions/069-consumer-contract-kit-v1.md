# ADR 069 — Provider-side portable consumer contract kits

Status: accepted for Feature 069.

## Decision

LA Muni RAG publishes closed JSON manifests for OS Electoral and Content Agency.
The manifests bind each supported interaction to the exact OpenAPI path/method,
required headers, success/error statuses, canonical request/response schemas,
examples, forbidden foreign-owned fields and preservation rules.

The repository verifier compares exact sets rather than checking only presence.
It also enforces the complete interaction inventory, canonical artifact bindings,
procedure-query output discriminators and a minimum forbidden-field guard set.

## Rationale

Provider tests alone can stay green while documentation or consumer assumptions
drift. A versioned machine-readable kit gives neighboring repositories a stable
artifact to pin by commit SHA without importing provider runtime code or sharing
storage.

## Limits

The CLI is provider-side. External repositories must run equivalent verification
and prove their own persistence, retry, revocation/supersession and failure
behavior. This ADR does not authorize deployment or production traffic.
