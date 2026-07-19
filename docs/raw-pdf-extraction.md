# Raw-PDF Extraction Operations

Status: local pre-production component; parser isolation is implemented, while a production scanner, tenant-safe ingestion jobs/storage/vector writes, and approved runtime sandbox remain absent.

## Allowed entry point

Raw PDFs may enter extraction only through the document-library sequence:

```text
import -> inspect -> current clean evidence -> ingest -> extract once -> index normalized document
```

The generic vector CLI and corpus backfill intentionally return
`pdf_requires_document_library` for `.pdf` paths. Supplying PDF bytes directly,
renaming a PDF, declaring another source format, or using the legacy JSONL helper
does not satisfy the safety gate.

See [Document Library and Ingestion Operations](document-library-operations.md)
for commands. Do not apply `ingest` to a real source until its scanner verdict,
tenant/storage/job/vector controls, documentary review, and human release decision
are approved.

## Configuration

```dotenv
PDF_EXTRACTION_MAX_INPUT_BYTES=67108864
PDF_EXTRACTION_TIMEOUT_MS=120000
PDF_EXTRACTION_MAX_PAGES=1000
PDF_EXTRACTION_MAX_PAGE_TEXT_BYTES=262144
PDF_EXTRACTION_MAX_TOTAL_TEXT_BYTES=8388608
PDF_EXTRACTION_MEMORY_MB=512
PDF_EXTRACTION_MAX_CONCURRENCY=1
```

Every value is integer-only and bounded by a compiled ceiling. Worker stdout is
calculated from the page/text policy; stderr is fixed at 64 KiB. Indexing separately
caps one document at 5,000 planned chunks and one embedding request at 64 texts.

## Runtime behavior

The parent accepts a binary `Buffer`, checks the PDF header/EOF boundary, copies
the bytes, and writes them to a dedicated child process over stdin. The worker
uses the exact locked PDF.js and native canvas packages, local supporting data,
and sequential page text extraction. It returns no parser logs—only strict
protocol version `1` JSON.

The parent validates the entire response before creating a normalized document.
Text-bearing pages become page sections with citations and per-page text hashes.
The document library supplies that object to indexing, so indexing does not read
the managed path or run the parser again.

The worker has a minimal environment, private empty working directory, bounded
V8 heap/stack/runtime/output, and Node read permissions only for its script and
required package roots. It has no filesystem-write, child-process, or
worker-thread permission. The production image copies the worker alongside the
compiled application.

## Stable failure codes

| Code | Meaning | Retry guidance |
|---|---|---|
| `pdf_requires_document_library` | direct raw-PDF route bypassed safety evidence | do not retry there; use the controlled library flow |
| `pdf_binary_input_required` | extractor received decoded text instead of bytes | fix the caller; non-retryable |
| `pdf_input_empty`, `pdf_input_too_large`, `pdf_signature_invalid` | byte boundary failed | review source/version; non-retryable |
| `pdf_encrypted` | parser requires a password | do not weaken the gate; obtain an approved unencrypted source/version |
| `pdf_malformed` | PDF.js rejected the structure | recover verified bytes or register a reviewed replacement version |
| `pdf_no_extractable_text` | no text-bearing page exists | use a separately designed and approved OCR workflow |
| `pdf_page_limit_exceeded`, `pdf_page_text_limit_exceeded`, `pdf_text_limit_exceeded` | document expansion exceeded policy | review the source and policy; never disable limits ad hoc |
| `pdf_timeout`, `pdf_output_limit_exceeded`, `pdf_worker_stderr_limit_exceeded` | worker exceeded a runtime channel bound | preserve evidence and investigate as hostile or pathological input |
| `pdf_worker_protocol_error` | child returned an invalid result | investigate parser/runtime integrity; non-retryable for the same build |
| `pdf_worker_unavailable`, `pdf_worker_crashed`, `pdf_worker_capacity_exceeded` | runtime/capacity failure | retry only through a bounded job policy after health review |
| `embedding_chunk_limit_exceeded` | normalized document planned too many chunks | review chunking/source; provider was not called |

Failure messages contain stable summaries, not raw parser/scanner output or
source content.

## What this does not prove

- The child is not a complete OS sandbox. Node permissions do not create a
  network namespace, seccomp boundary, or native-memory/RSS limit.
- The native canvas dependency is pinned directly but remains inside the parser
  process and must be covered by dependency and image review.
- A per-process concurrency count is not a distributed queue, tenant quota,
  lease, lock, or retry system.
- Text extraction is not OCR, table reconstruction, form processing, document
  approval, legal validity, or evidence promotion.
- A clean unit/integration result is not a real ClamAV verdict or production
  deployment attestation.

The historical `scripts/extract_pdf_sections.py` and JSONL normalizer remain for
explicit offline migration/review only. They are not registered as the `.pdf`
extractor and must not be used to bypass controlled ingestion.

Implementation decisions, risks, and verification mapping are in the
[Feature 055 decision log](decisions/055-isolated-raw-pdf-extraction.md),
[risk register](risks/055-isolated-raw-pdf-risk-register.md), and
[requirements traceability](traceability/055-requirements-traceability.md).
