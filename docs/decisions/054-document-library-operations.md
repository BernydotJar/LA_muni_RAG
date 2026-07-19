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

## D-054-08 — Domain metadata is indexable

`DomainDocumentMetadata` now declares an index signature because the vector indexing boundary accepts generic metadata records while the domain still requires its typed fields.

## D-054-09 — No publication semantics

`ingested` means artifact identity, extraction, indexing and manifest reconciliation succeeded. It does not mean the document is legally approved, current, published to users or institutionally adopted.
