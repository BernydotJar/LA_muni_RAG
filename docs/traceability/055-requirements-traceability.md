# Requirements Traceability — Feature 055

| Requirement | Implementation | Verification |
|---|---|---|
| Use exact reviewed parser/native dependencies | `pdfjs-dist` and `@napi-rs/canvas` exact versions in `package.json` and lockfile | dependency metadata/audit and lock diff |
| Keep raw parsing outside the API process | `runPdfExtractionWorker` spawns `scripts/pdf-extraction-worker.mjs` | real valid/corrupt/no-text worker tests |
| Accept binary bytes only | `extractRawPdf` requires `Buffer` | `pdf_binary_input_required` test |
| Never reopen managed artifact in parser | copied buffer is written to child stdin; PDF.js receives `Uint8Array` | vector no-reread test and static worker review |
| Never use remote parser resources | local CMap/font/ICC paths; worker fetch and WASM disabled | worker option review and permission-argument test |
| Bound input, time, pages, page text, total text, heap, output, stderr, and concurrency | `PdfExtractionPolicy`, parent channel counters, worker checks | bounded policy, hang, stdout flood, and stderr flood tests |
| Return only a strict versioned protocol | exact-key/type/order/count/version validation | invalid worker and injected protocol tests |
| Fail closed for corrupt/text-free/encrypted input | worker error mapping and parent `IngestionError` codes | real corrupt/no-text and controlled encrypted-result tests |
| Preserve page citations and parser provenance | parent builds page sections and metadata | real valid PDF assertions |
| Parse an accepted artifact once | `extractDocument` returns `NormalizedDocument`; vector input accepts it and merges trusted metadata without reparsing | document-library parse/section-identity test |
| Reject raw PDF vector bypass | format gate before provider configuration | vector zero-read/zero-extract test |
| Reject raw PDF backfill before file read | `buildDocumentInput` path/format gate | missing `.pdf` CLI test yields stable code rather than `ENOENT` |
| Hash and pass exact backfill bytes for supported formats | binary corpus content and SHA-256 | DOCX byte identity/hash test |
| Bound embedding requests and total chunks | `indexDocument` 5,000 cap and 64 default batch | chunk-limit and `[2,2,1]` batch tests |
| Scan immutable bytes rather than mutable path | `scanVerifiedSnapshot`; clamd stream mode | ABA mutation and snapshot-tamper tests |
| Ship the worker in the production image | runtime `Dockerfile` copy | container build/file inspection gate |
| Preserve stable extraction failures at the library boundary | `failureResult` recognizes `IngestionError` | `pdf_timeout` preservation test |
| Keep legacy JSONL flow explicit | raw registry uses `rawPdfExtractor`; legacy adapter separately named | registry/legacy normalization tests |
| Document residual isolation limits | raw-PDF operations, threat model, decision/risk logs | changed-link and governance review |
| Do not parse or index the real DMP | no DMP operation or inventory mutation in this feature | source inventory and worktree evidence |
