# 008 Embedding Indexing Pipeline Tasks

Status: Implemented

## Spec Phase

- [x] Define objective.
- [x] Define non-goals.
- [x] Define indexing flow.
- [x] Define provider boundary.
- [x] Define idempotency model.
- [x] Define metadata/provenance requirements.
- [x] Update `feature_list.json`.
- [x] Update `progress/current.md`.
- [x] Append `progress/history.md`.

## Implementation Phase

- [x] Define embedding types.
- [x] Implement chunk planner.
- [x] Implement deterministic chunk identity.
- [x] Define embedding provider interface.
- [x] Implement indexer orchestration without external API calls in tests.
- [x] Implement repository boundary.
- [x] Add tests for chunk planning.
- [x] Add tests for chunk identity/idempotency.
- [x] Add tests for indexer failure handling.
- [x] Include `sectionType` and `citationLabel` in chunk identity.
- [x] Add identity tests for section type and citation label changes.
- [x] Validate provider vector count before writing embeddings.
- [x] Add vector count mismatch tests for fewer and extra vectors.
- [x] Preserve selected document-level provenance in chunk metadata.
- [x] Add provenance metadata preservation test.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run test`.

## Stop Condition

Implementation was approved and completed. Future work should add a real
provider implementation, database migrations, and vector retrieval behind
separate approvals.
