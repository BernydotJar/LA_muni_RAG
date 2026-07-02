# 007 DOCX Extractor Mammoth Requirements

Status: Implemented

## Objective

Replace the DOCX ingestion stub with a real DOCX extractor powered by
`mammoth`, while preserving the existing normalized ingestion contracts.

## Acceptance Criteria

- Adds `mammoth` as an approved dependency.
- `docxExtractor` extracts plain text from DOCX buffers and paths.
- Output conforms to `NormalizedDocument`.
- Sections conform to `NormalizedSection`.
- Title is inferred from the first heading-like line when present, otherwise
  from the explicit input title, otherwise from the filename.
- Article numbers and headings are detected with existing normalization helpers.
- Registry-based DOCX extraction works.
- Markdown, TXT, PDF adapter, retrieval, evidence, answer, chat, and server
  behavior remain unchanged.

## Non-Goals

- No embeddings.
- No LLM-assisted DOCX interpretation.
- No database writes.
- No UI changes.
- No migration changes.
