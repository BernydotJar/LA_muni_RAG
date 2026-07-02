# 006 Document Ingestion Multiformat Tasks

Status: Implemented

## Spec Phase

- [x] Define feature objective.
- [x] Define supported formats.
- [x] Define normalized output model.
- [x] Define non-goals.
- [x] Define proposed module layout.
- [x] Update `feature_list.json`.
- [x] Update `progress/current.md`.
- [x] Append `progress/history.md`.

## Implementation Phase

- [x] Define `NormalizedDocument` and `NormalizedSection` types.
- [x] Add source format detection.
- [x] Add shared text normalization helpers.
- [x] Add citation label helpers.
- [x] Add Markdown extractor.
- [x] Add TXT extractor.
- [x] Add DOCX extractor stub that reports the required parser dependency.
- [x] Add PDF extractor adapter for existing JSONL output.
- [x] Add extractor registry.
- [ ] Add ingestion CLI script.
- [x] Add tests with sample Markdown input.
- [x] Add tests with sample TXT input.
- [x] Add DOCX dependency-reporting test.
- [x] Verify current PDF flow remains unchanged through adapter tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run test`.

## Stop Condition

Implementation was approved and completed. A future feature should add an
ingestion CLI script and a real DOCX parser dependency if DOCX extraction is
approved.
