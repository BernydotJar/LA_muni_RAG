# 007 DOCX Extractor Mammoth Design

Status: Implemented

## Dependency

The feature uses `mammoth` for DOCX parsing.

`mammoth.extractRawText()` is used intentionally. It produces plain text and
keeps this feature inside the existing normalization model. A future feature can
use `mammoth.convertToHtml()` if heading style metadata becomes necessary.

## Flow

```text
DOCX buffer or path
  -> mammoth.extractRawText()
  -> normalizeWhitespace()
  -> infer title
  -> split by heading/article signals
  -> NormalizedDocument
```

## Title Inference

The extractor chooses the title in this order:

1. First non-empty text line if it looks like a heading.
2. Explicit `input.title`.
3. Filename without `.docx`.
4. Fallback `"Documento DOCX"`.

## Sectioning

DOCX text uses the same conservative text signals as TXT ingestion:

- `Articulo N`
- numbered headings
- short all-caps heading-like lines

Each section receives:

- `sectionType`
- `sectionPath`
- `articleNumber`
- `citationLabel`
- `metadata.extractor = "mammoth_raw_text_v1"`

## Preservation

No PDF, Markdown, TXT, retrieval, evidence, answer, chat, or server behavior is
changed.
