# Feature 085 - Controlled real corpus ingestion v1

## Goal

Complete the existing `WS02-CORPUS-ACQUISITION-001` task for an authorized bounded public Antigua corpus using the current artifact, tenant, extraction, vector, and evidence controls.

## Approved initial sources

1. `antigua-pdm-ot`, official municipal PDF module 1, expected SHA-256 `824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b` and expected size 34,822,596 bytes.
2. `antigua-mnp-dmp-v3-2026`, official municipal DMP v3 PDF, expected SHA-256 `4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9` and expected size 49,052,885 bytes.

## Requirements

- Acquire only through the already registered HTTPS municipal URLs.
- Reject redirects to unapproved origins, wrong media type, wrong signature, wrong size, or wrong hash.
- Keep raw bytes outside Git and record content-addressed receipts only.
- Run a current malware scanner and bind the exact clean verdict to the exact bytes.
- Extract through the bounded raw-PDF worker.
- Persist tenant-scoped chunks in PostgreSQL/pgvector under forced RLS.
- Produce a corpus manifest and source inventory reconciliation with non-zero sections and chunks.
- Never promote source authority, vigencia, legal applicability, completeness, or institutional approval from ingestion alone.
- Do not credit synthetic fixtures as corpus evidence.

## Non-goals

- Republishing source PDFs.
- Claiming a complete municipal corpus.
- Claiming legal validity or current applicability.
- Provisioning production object storage or cloud infrastructure without separate credentials and approval.

## Gate

The node is complete only after source verification, clean malware evidence, real tenant-scoped ingestion, manifest reconciliation, independent review, regression, and exact-SHA remote CI pass.
