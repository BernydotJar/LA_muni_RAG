# 006 Document Ingestion Multiformat Design

Status: Spec Ready

## Design Principle

Extraction is not retrieval. Extraction should preserve document structure,
normalize text, and produce auditable artifacts. Retrieval and embeddings should
consume the normalized output later.

For municipal and legal RAG, ingestion quality is epistemic quality: weak
structure creates weak citations. The system should therefore normalize source
documents before any vectorization work.

## Proposed Flow

```text
data/raw/core-documents/documento.md
data/raw/core-documents/documento.txt
data/raw/core-documents/documento.docx
data/raw/core-documents/documento.pdf
        |
        v
format detection
        |
        v
extractor registry
        |
        v
NormalizedDocument
        |
        v
normalized sections
        |
        v
artifacts/*.jsonl
        |
        v
reviewed PostgreSQL load
```

## Proposed Module Layout

```text
src/ingestion/
  types.ts
  detectFormat.ts
  normalize.ts
  citation.ts
  registry.ts
  extractors/
    markdownExtractor.ts
    txtExtractor.ts
    docxExtractor.ts
    pdfExtractorAdapter.ts

scripts/
  ingest_document.ts

src/__tests__/
  ingestion-markdown.test.ts
  ingestion-txt.test.ts
  ingestion-docx.test.ts
```

## Normalized Model

```text
NormalizedDocument
  title
  sourceFormat
  text
  sections[]
  metadata

NormalizedSection
  heading
  sectionType
  sectionPath
  text
  pageStart/pageEnd
  articleNumber
  citationLabel
```

## Extractor Responsibilities

Markdown extractor:

- Preserve heading hierarchy.
- Split sections by headings.
- Detect article-like headings when possible.
- Produce citation labels from title and section path.

TXT extractor:

- Normalize whitespace.
- Split on strong heading/article signals when present.
- Fall back to stable paragraph or block sections.
- Produce conservative citation labels.

DOCX extractor:

- Extract paragraphs and heading styles.
- Preserve heading hierarchy when style metadata is available.
- Detect article-like headings from text.
- Produce sections with stable ordering.

PDF adapter:

- Preserve the existing PDM-OT extraction path.
- Adapt current page-level output into the normalized model only if needed.
- Avoid changing reviewed PDF artifacts unless explicitly approved.

## Artifact Strategy

JSONL remains the primary review artifact. SQL generation should remain
optional and explicit because database loading is an operational step.

## Risks

- DOCX parsing may require a new dependency.
- Legal documents may use inconsistent heading patterns.
- Over-aggressive splitting can damage citation quality.
- Under-splitting can create sections too large for retrieval and embeddings.

## Deferred Work

- Embeddings.
- Vector search.
- Automated database loading.
- UI ingestion controls.
- LLM-assisted document structuring.
