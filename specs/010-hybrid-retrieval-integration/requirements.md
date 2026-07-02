# Requirements: Hybrid Retrieval Integration

Feature: 010-hybrid-retrieval-integration  
Mode: SHIP  
Status: spec_ready

## Problem

Feature 009 added a deterministic hybrid retrieval ranking layer in `src/retrieval/**`, but that layer is not yet integrated into the live evidence or search flows.

The system still exposes keyword and phrase retrieval through the existing evidence path. Hybrid retrieval must be introduced carefully so the project gains better evidence discovery without weakening the existing answer gate.

## Goal

Integrate the hybrid retrieval layer into the evidence/search flow in a controlled, testable way.

The integration must preserve:

- deterministic behavior
- citation integrity
- evidence-first answer policy
- existing keyword and phrase modes
- current `/api/answer` no-evidence behavior

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions.
5. New ingestion formats.
6. New migrations unless explicitly approved.
7. External embedding API calls in tests.
8. Changes to the legal/municipal answer policy.
9. Replacement of keyword or phrase modes.

## Functional Requirements

### FR-1: Hybrid Evidence Mode

The evidence layer must support a controlled hybrid mode.

Hybrid mode must combine eligible phrase, keyword, and vector candidates through the existing 009 retrieval layer.

### FR-2: Backward Compatibility

Existing `keyword` and `phrase` modes must continue working as they do now.

Existing tests for evidence, answer, chat, and server contracts must keep passing.

### FR-3: Evidence-First Policy Preservation

Hybrid mode must still return no answer when no citable evidence exists.

No evidence must still mean no answer.

### FR-4: Citation Integrity

Every returned hybrid evidence item must include a citation label.

Uncitable candidates must be filtered before evidence is returned.

### FR-5: Deterministic Vector Boundary

Vector candidates must enter through a deterministic or test-safe boundary.

Tests must not call external APIs.

### FR-6: API Compatibility

If the public API accepts a retrieval mode parameter, `hybrid` may be added only if validation and tests are updated.

Existing invalid-mode behavior must remain explicit and tested.

### FR-7: Explainability

Hybrid results must preserve enough information to explain why evidence was ranked:

- retrieval mode
- matched modes when available
- score
- citation label
- source type
- excerpt

## Quality Requirements

### QR-1: Deterministic Tests

All tests must be offline and deterministic.

### QR-2: Minimal Runtime Surface

Only the minimum required files may be changed.

### QR-3: No Policy Drift

No answer generation policy may change.

### QR-4: Reviewability

The integration must be small enough to review in one pass.

## Acceptance Criteria

The feature can move to review when:

1. Hybrid mode is supported by the evidence layer or an equivalent integration boundary.
2. Keyword and phrase modes remain backward compatible.
3. Hybrid evidence items preserve citations.
4. Uncitable candidates are filtered.
5. Existing answer behavior remains evidence-first.
6. Server validation is updated if `hybrid` becomes an API mode.
7. Tests cover hybrid evidence behavior.
8. Tests cover unchanged keyword and phrase behavior.
9. No LLM calls are introduced.
10. No external API calls are required in tests.
11. `npm run typecheck` passes.
12. `npm run build` passes.
13. `npm run test` passes.
