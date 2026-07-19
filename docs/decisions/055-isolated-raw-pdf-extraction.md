# Decision Log — Feature 055

## D-055-01 — Use PDF.js directly and pin it exactly

The runtime uses `pdfjs-dist@6.1.200` and `@napi-rs/canvas@1.0.2` directly under
`package-lock.json`.

Reason: a direct API avoids an additional wrapper dependency and makes parser
version, byte input, page iteration, cleanup, native polyfill, and resource
options reviewable. Declaring canvas directly prevents a production install from
silently omitting a package the Node build requires.
Registry/lock metadata records Apache-2.0 for PDF.js and MIT for canvas; release
review must still preserve required notices and validate the built artifact.
The existing Python/PyPDF utility is unpinned, absent from the container, and
specialized for the historical DMP workflow.

## D-055-02 — Parse in a separate process

PDF.js runs in a dedicated Node child process, not in the API process or a
worker thread.

Reason: the Node PDF.js build uses a fake internal worker. An outer process gives
the parent a kill boundary for crashes, wall time, V8 heap, stdout, and stderr.

## D-055-03 — Do not call the process a complete sandbox

Documentation describes the control as bounded process isolation.

Reason: Node permissions do not create network, seccomp, container, or total
native-memory isolation, and the Node runtime loads native canvas code.
Production still needs an approved runtime/container profile.

## D-055-04 — Pass bytes over stdin; never pass a path or URL

The worker calls PDF.js with an in-memory `Uint8Array`. It does not reopen the
managed artifact or fetch a remote source.

Reason: parser input must remain identical to the post-scan/hash-verified buffer.

## D-055-05 — Parse once

The document library receives one normalized document from extraction and sends
that object to vector indexing. It does not separately count sections and then
parse again.

Reason: duplicate parsing doubles attack surface and cost and could produce
different results if a parser or path changes between passes.

## D-055-06 — Reject generic PDF entry points

`.pdf` vector indexing and corpus backfill fail with
`pdf_requires_document_library` unless the document-library path supplies the
already normalized document.

Reason: generic indexing does not possess acquisition and current clean scan
evidence.

## D-055-07 — Keep the JSONL adapter explicit and legacy

The historical JSONL normalizer remains importable for controlled migration but
is not registered for `.pdf` paths.

Reason: JSONL text is not raw PDF bytes and does not prove the artifact passed
the current safety decision.

## D-055-08 — Bound expansion and provider fan-out

Input bytes, time, pages, page text, total text, protocol channels, V8 heap, and
per-process concurrency are bounded. Downstream indexing caps planned chunks at
5,000 and sends at most 64 texts per embedding request.

Reason: a small or pathological PDF can expand into expensive parser output,
memory, embedding traffic, and vector writes.

## D-055-09 — Text-bearing pages are the first extraction unit

The extractor emits one section per page containing normalized text and preserves
page citations. It fails on documents with no extractable text.

Reason: page boundaries are deterministic and citable. OCR, tables, forms,
headings, and legal structures require separate reviewed features and evaluations.

## D-055-10 — Scan a private verified snapshot

ClamAV receives a private mode-0600 snapshot created from the verified buffer,
not the mutable managed path. `clamdscan` uses stream mode.

Reason: pre/post hashing of a mutable path alone permits an ABA substitution
during the scanner read. Snapshot hashes are verified before and after scanning,
then the managed path is checked again.
