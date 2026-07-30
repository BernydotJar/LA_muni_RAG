# Independent review — Feature 085 controlled real corpus ingestion

## Verdict

PASS WITH LIMITATIONS, pending exact-SHA remote CI.

## Scope reviewed

Feature 085 executes the existing Graph Harness node `WS02-CORPUS-ACQUISITION-001` against two previously identified public municipal PDFs. It does not introduce a parallel ingestion architecture. It composes the existing persisted artifact acceptance, tenant-scoped job lease, bounded PDF extractor, pgvector repository, forced-RLS persistence and source-inventory reconciliation.

## Producer evidence

### PDM-OT module 1

- Official municipal HTTPS source: `MODULO_1_PDMOT.pdf`.
- Exact SHA-256: `824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b`.
- Exact byte length: 34,822,596.
- ClamAV: clean, engine 1.4.3, definitions 28076 dated 2026-07-29.
- Bounded extraction: 224 sections.
- Tenant-scoped vector persistence: 444 chunks.
- Inventory state: `ingested`.

### DMP manual version 3

- Official municipal HTTPS source: `6_2026_eu9Z7.pdf`.
- Exact SHA-256: `4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9`.
- Exact byte length: 49,052,885.
- ClamAV: clean, engine 1.4.3, definitions 28076 dated 2026-07-29.
- Independent Poppler inspection: 170-page EPSON scan, no fonts, no extractable text in the inspected sample.
- Bounded extractor result: `pdf_no_extractable_text`.
- Inventory state: `failed`, with the clean acquisition evidence preserved and no chunks credited.

## Critic and red-team findings

### Finding 1 — canonical document identity was absent from the worker lease

The first real run exposed a production-significant defect hidden by test doubles: the worker generated chunks using the document-version UUID as `documentKey` and a placeholder version. Completion correctly rejected those records against server-owned document metadata with `vector_record_scope_mismatch`.

The repair is localized:

- `LeasedIngestionJob` now requires server-owned `documentKey`, `documentTitle` and `documentVersion`.
- `PostgresIngestionJobService.leaseNext()` reads that identity in the same tenant transaction.
- `TenantIngestionWorker` uses the leased identity for extraction and chunk planning.
- Completion continues to re-read and verify the persisted identity, preserving defense in depth.
- Regression tests require the canonical identity in emitted vector records.

### Finding 2 — DMP v3 has no extractable text

The pipeline failed closed. No OCR was attempted because legal Spanish OCR accuracy, page fidelity and human validation do not yet have an approved quality gate. The document is not counted as ingested.

### Finding 3 — Docker is unavailable in the Cloud Sandbox runtime

The pinned pgvector container could not register filesystem layers. The repair uses a local disposable PostgreSQL 15.18 cluster with pgvector 0.8.5, loopback-only networking, SCRAM host authentication, random ephemeral credentials, a non-owner `NOBYPASSRLS` runtime role and mandatory teardown. This preserves the intended database controls without weakening them.

### Finding 4 — local evaluation embeddings are not semantic production embeddings

The vector representation is explicitly named `local-eval-hashing/token-bigram-hash-1536-v1`. It is deterministic lexical hashing for bounded local evaluation. Receipts and inventory prohibit a semantic-model, production-provider or general retrieval-quality claim.

## Security and privacy review

- Downloads are restricted to the registered `https://muniantigua.gob.gt` origin.
- Redirects, credentials, query strings, fragments, media drift, size drift and hash drift are rejected.
- Raw PDFs remain outside Git.
- Malware and structural evidence are bound to exact bytes.
- Acceptance writes use an administrative connection; worker and vector writes use a distinct non-owner, no-bypass runtime role.
- Five relevant tables are verified as non-owner `FORCE ROW LEVEL SECURITY`.
- Diagnostic output is allowlisted to error class, stable code, source code and retryability; messages, SQL, paths and credentials are excluded.
- Receipts contain no database URLs or passwords.

## Limitations

- Exactly one document is credited as ingested; this is not a complete municipal corpus.
- DMP v3 still requires an OCR quality and human-validation decision before ingestion.
- The database and local artifact reader are disposable evidence infrastructure, not a production object store or managed deployment.
- The local lexical hash representation is not evidence of semantic retrieval quality.
- Ingestion does not prove legal validity, current applicability, completeness or institutional approval.
- Exact-SHA remote CI remains required before the Graph Harness gate can pass.
