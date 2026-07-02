# 007 DOCX Extractor Mammoth Tasks

Status: Done

## Completed

- [x] Read harness state and 006 ingestion specs.
- [x] Add approved `mammoth` dependency.
- [x] Replace DOCX stub with real `mammoth.extractRawText()` implementation.
- [x] Preserve `NormalizedDocument` and `NormalizedSection` contracts.
- [x] Add title inference.
- [x] Reuse existing heading/article detection helpers.
- [x] Update DOCX tests from dependency-error behavior to real extraction.
- [x] Validate registry-based DOCX extraction.
- [x] Register PDF adapter in the ingestion registry.
- [x] Add registry-based PDF JSONL adapter test.
- [x] Normalize invalid and empty DOCX failures into `IngestionError`.
- [x] Preserve original DOCX parser error as `cause`.
- [x] Review package-lock root license metadata and retain as npm metadata sync.
- [x] Update `feature_list.json`.
- [x] Update `progress/current.md`.
- [x] Append `progress/history.md`.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [x] Run `npm run test`.

## Deferred

- Style-aware heading extraction using `mammoth.convertToHtml()`.
- Dedicated local DOCX fixture generation.
- Ingestion CLI wiring.
