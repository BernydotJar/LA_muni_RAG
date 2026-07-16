# Design — 049 Procedure Query Understanding

## Context

The existing advisor already classifies `procedureType`, detects named cases and communities, retrieves evidence, composes workflows, detects gaps, and applies governance. The missing layer is an explicit primary query intent that can drive future retrieval orchestration without conflating topic, case context, and requested outcome.

## Decision

Add deterministic routing metadata to `ProcedureQueryClassification`:

- `intent`
- `intentSignals`
- `requiresCaseContext`
- `requiresNormativeRetrieval`

Intent precedence is fixed:

1. closure/liquidation
2. named case or current-status request
3. planning/project
4. legal
5. procedural
6. documentary
7. unknown

The classifier remains domain-pack aware for `procedureType`. Intent is inferred with bounded phrase rules. Stable signal labels explain the matched rule without exposing hidden reasoning.

## Retrieval Query Strategy

- Preserve the original query at index zero.
- Add one intent-specific retrieval phrase.
- Add domain-pack workflow queries and hints.
- Add case, community, and external-municipality context queries.
- Remove empty and normalized duplicate queries while preserving first occurrence order.

## Compatibility

- No schema migration.
- No database or network changes.
- Existing workflow composition consumes the expanded classification object without behavioral changes.
- Existing source-authority and safety rules remain unchanged.

## Validation

Focused tests cover all intent families, precedence, routing flags, deterministic query order, deduplication, and the existing workflow scenarios.
