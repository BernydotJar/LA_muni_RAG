# Decision Log — Feature 054

## D-054-01 — Local import only

Feature 054 accepts operator-provided local artifacts. It does not download documents or run background acquisition.

Reason: a URL or portal listing is not evidence that a specific document version was acquired.

## D-054-02 — Hash raw bytes

Acquisition evidence uses SHA-256 over the raw artifact bytes, including PDF and DOCX files.

Reason: hashing decoded UTF-8 text can corrupt binary identity and disagree with the acquired artifact.

## D-054-03 — Deterministic bounded paths

Imported files are copied to a deterministic path derived from source id and document version under a configured library root. Resolved paths must remain below that root.

Reason: prevent path traversal and make repeated operations predictable.

## D-054-04 — Dry-run is read-only

Dry-run may read and validate the inventory, artifact and operational manifest, but it does not copy files, invoke the indexer or write manifests.

## D-054-05 — Inventory and operational manifest remain separate

The source inventory records documentary lifecycle and provenance. The operational corpus manifest records indexing outcomes. Ingestion is only complete when both agree.

## D-054-06 — Idempotency by source/version/hash

Repeating an identical import or ingestion returns `noop`. Reusing the same source/version with a different hash fails closed.

## D-054-07 — Existing extraction and indexing boundaries are reused

Feature 054 does not add another extractor or embedding implementation. It invokes the existing registry and vector indexer and records their verified outcomes.

Feature 055 later replaced the registered raw-PDF JSONL adapter with a bounded
raw-byte extractor while preserving these registry/indexing boundaries.

## D-054-08 — Domain metadata is indexable

`DomainDocumentMetadata` now declares an index signature because the vector indexing boundary accepts generic metadata records while the domain still requires its typed fields.

## D-054-09 — No publication semantics

`ingested` means artifact identity, extraction, indexing and manifest reconciliation succeeded. It does not mean the document is legally approved, current, published to users or institutionally adopted.

## D-054-10 — Acquisition, safety acceptance, and ingestion are separate states

Import performs size, extension, declared-MIME, byte-signature, copy, and hash
checks, but it records only `acquired`. A separate `inspect` operation must bind a
clean malware verdict to the same path/hash/size/media identity before any
extractor runs.

Reason: a structurally valid PDF or DOCX can still contain malicious content, and
a scanner verdict can become stale or refer to different bytes.

## D-054-11 — External malware analysis fails closed

Only fixed `clamdscan` or `clamscan` modes are accepted. The adapter executes the
binary without a shell, bounds time/output, records engine/definition versions,
and treats absence, timeout, exit error, encrypted/over-limit alert, or infection
as a blocking result. No heuristic signature check is labeled malware scanning.

## D-054-12 — Quarantine preserves expected acquisition identity

Applied inspection failures publish regular managed bytes below a separate
bounded quarantine root with an atomic no-replace hard link, remove the prior
name, and record observed identity separately. The
expected acquisition hash is never rewritten to make tampered bytes acceptable.
A clean retry may restore unchanged bytes after a transient scanner failure.

## D-054-13 — The verified buffer crosses the extraction/indexing boundary

Import writes the already validated in-memory bytes to a non-overwriting staging
file before atomic no-replace publication. Ingestion passes the exact
post-scan/hash-verified
buffer into the vector indexing boundary instead of asking it to reread a mutable
path.

Reason: path re-reads introduce time-of-check/time-of-use substitution between
safety acceptance, extraction, and embedding.

## D-054-14 — Scan a private snapshot

Inspection writes the verified in-memory bytes to a private mode-0600 temporary
snapshot, verifies it, scans that path, verifies it again, and then rechecks the
managed path. `clamdscan` is invoked in stream mode.

Reason: scanning the mutable managed path with only pre/post hashes permits an
ABA substitution in which the scanner sees different bytes but the final hash
returns to the expected value.
