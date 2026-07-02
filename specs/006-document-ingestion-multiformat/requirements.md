# 006 Document Ingestion Multiformat Requirements

Status: Spec Ready

## Objective

Add production-oriented multi-format ingestion support for Markdown, TXT, and
DOCX while preserving the existing PDF extraction path.

The feature must produce normalized document sections that are ready for
PostgreSQL storage and future embeddings.

## Supported Inputs

- `.md`
- `.txt`
- `.docx`
- Existing `.pdf` flow remains supported through the current extraction path.

## Required Output Model

All extractors must output a common normalized representation.

### NormalizedDocument

- `title`
- `sourceFormat`
- `text`
- `sections`
- `metadata`

### NormalizedSection

- `heading`
- `sectionType`
- `sectionPath`
- `text`
- `pageStart`
- `pageEnd`
- `articleNumber`
- `citationLabel`

`pageStart` and `pageEnd` are required when available from the source format.
`articleNumber` is required when detected.
`citationLabel` should be produced whenever enough metadata exists to cite the
section responsibly.

## Acceptance Criteria

- Defines shared ingestion types for normalized documents and sections.
- Adds Markdown extraction.
- Adds TXT extraction.
- Adds DOCX extraction.
- Adds an extractor registry or equivalent dispatch mechanism.
- Keeps the current PDM-OT PDF flow intact.
- Produces JSONL artifacts for review before database loading.
- Produces optional SQL artifacts when the target document metadata is known.
- Includes tests with sample Markdown, TXT, and DOCX inputs.
- Does not degrade existing retrieval, evidence, answer, chat, or server tests.

## Non-Goals

- No LLM calls.
- No embeddings.
- No UI redesign.
- No authentication work.
- No production deployment.
- No destructive database changes.
- No rewrite of the current PDF extraction script unless an adapter is needed.
