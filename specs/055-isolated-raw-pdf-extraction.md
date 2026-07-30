# Feature 055 — Isolated Raw-PDF Extraction

## Goal

Extract page-level text from accepted raw PDF bytes through a bounded parser process, preserve citation provenance, and hand one normalized document to indexing without reopening or reparsing the managed artifact.

## Dependencies

- Feature 054 acquisition, structural validation, malware decision, quarantine, and clean-evidence freshness gate.
- Existing normalized-document, chunk-planning, embedding, and corpus-manifest contracts.
- Exact runtime dependencies `pdfjs-dist@6.1.200` and
  `@napi-rs/canvas@1.0.2` under the repository lockfile.

## Required flow

1. `document-library ingest` requires current, matching clean artifact-safety evidence.
2. The library rereads and verifies the acquired hash and size, then calls the PDF extractor with a `Buffer` containing those exact bytes.
3. The parent copies the buffer and sends it over stdin to a dedicated Node child process. It never passes a source URL or asks the child to reopen the managed path.
4. The worker loads PDF.js locally, parses a `Uint8Array`, processes pages sequentially, and returns a versioned, bounded JSON result.
5. The parent strictly validates every result field and constructs page-level normalized sections and citations.
6. The document library passes that same normalized document to vector indexing. The vector boundary neither rereads nor reparses it.
7. Direct `.pdf` vector-index and corpus-backfill entry points fail with `pdf_requires_document_library`.

## Resource policy

| Resource | Default | Compiled ceiling |
|---|---:|---:|
| input bytes | 64 MiB | 100 MiB |
| wall time | 120 seconds | 300 seconds |
| pages | 1,000 | 5,000 |
| normalized text per page | 256 KiB | 1 MiB |
| normalized text per document | 8 MiB | 32 MiB |
| child V8 heap | 512 MiB | 1,024 MiB |
| child processes per application process | 1 | 4 |
| embedding chunks per document | 5,000 | 5,000 |
| texts per embedding request | 64 | 64 |

Worker stdout is derived from the text/page policy and capped at 64 MiB. Worker stderr is fixed at 64 KiB. Invalid environment values and values above the compiled ceilings fail before parsing.

## Parser-process controls

- separate OS process rather than an in-process call or worker thread;
- bounded V8 heap, stack, wall time, stdin, stdout, stderr, pages, and text;
- minimal environment and private empty working directory;
- Node permission mode with read access limited to the worker and exact PDF.js/native-canvas package roots;
- no filesystem-write, child-process, or worker-thread permission;
- PDF bytes supplied only through `getDocument({ data: Uint8Array })`;
- local CMap, standard-font, and ICC data only;
- worker fetch, WASM, XFA, system fonts, font-face loading, image decoding, and offscreen canvas disabled;
- encrypted, malformed, text-free, over-limit, timed-out, crashed, and invalid-protocol results fail closed with stable codes;
- temporary working directories are removed on every parent outcome.

## Output contract

The worker protocol is schema version `1`. A success contains only:

- `schemaVersion`;
- `ok`;
- parser name and exact runtime version;
- declared page count;
- increasing, unique, bounded page numbers and non-empty page text.

The parent rejects unknown keys, invalid UTF-8/JSON, unsupported parser identity, invalid semantic version, page-order/count errors, or text above policy. Parser diagnostics and raw stderr are not exposed to operators.

## Extraction semantics

- one normalized section per text-bearing page;
- page start/end and citation label preserved;
- page-text SHA-256 recorded in section metadata;
- no OCR, image transcription, handwriting recognition, table reconstruction, form execution, JavaScript execution, or legal/documentary interpretation;
- a text-free scanned PDF returns `pdf_no_extractable_text` and requires an independently reviewed OCR feature.

The prior JSONL/Python adapter remains an explicit legacy conversion utility only. It is not registered for raw `.pdf` paths and is not part of controlled ingestion.

## Security truth and residual boundary

The child process provides crash, timeout, protocol, and V8-heap separation. It
is not a complete hostile-file sandbox. The Node permission model does not
provide a network namespace, seccomp profile, container boundary, or total
RSS/native-memory cap, and PDF.js requires native canvas code in this Node
runtime. The package is declared and pinned directly rather than left as an
optional transitive install. Production approval still requires an approved
container/runtime isolation profile, dependency/image scanning, load and
parser-abuse tests, and monitoring.

The concurrency counter is local to one application process, not a distributed job quota. Authenticated tenant-scoped upload/storage, durable jobs, leases/locks, retry policy, append-only audit, and tenant-scoped vector writes remain outside this feature. The acquired DMP remains unparsed and unindexed until those gates and a real clean scanner verdict exist.

## Acceptance criteria

- valid raw bytes produce page-cited normalized text through the real worker;
- malformed, text-free, encrypted, oversized, over-page, over-text, hung, output-flooding, stderr-flooding, crashed, and invalid-protocol paths fail with stable results;
- direct PDF vector/backfill paths fail before provider setup or file reads;
- accepted library ingestion parses exactly once and passes the normalized object to indexing;
- scanner input is an immutable private snapshot, not the mutable managed path;
- chunk count and embedding request size are bounded before provider cost expands;
- exact dependency, container worker file, environment policy, runbook, decisions, risks, and traceability are committed;
- typecheck, build, focused tests, dependency audit, full regression suite, and repository governance gates pass;
- no real DMP extraction, index, deployment, or production claim occurs without human approval.
