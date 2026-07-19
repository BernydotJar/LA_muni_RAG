# Source Inventory Reconciliation — Antigua PDM-OT

## Decision

The `antigua-pdm-ot` record is `verified`, not `acquired` or `ingested`.

The official municipal URL and a matching local PDF identity are documented, but the raw PDF lives under the Git-ignored `data/raw/` tree. It has not been imported into a controlled Feature 054 library root, and `.rag/` has no operational corpus manifest that reconciles its version and hash. A clean clone therefore has portable verification evidence, not portable acquisition or ingestion evidence.

## Portable evidence

| Claim | Evidence |
|---|---|
| Official source | `https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf` on the Municipalidad de La Antigua Guatemala domain |
| Verification date | `docs/core-document-download-log.md` identifies the PDF as verified and is dated `2026-06-22`; the seed independently records `downloaded_at = 2026-06-22` |
| Semantic version | `official-municipal-pdf-2026-06-22` in `db/seeds/002_document_versions.sql` |
| Expected local path | `data/raw/core-documents/pdm-ot-antigua-modulo-1.pdf` |
| SHA-256 over raw bytes | `824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b` |
| Expected byte length | `34,822,596` |
| Media type | `application/pdf` |

Only the date is recorded because the evidence does not establish an exact verification or acquisition time.

## Local artifact check

On the reconciled workstation, the optional raw artifact produced the expected SHA-256 and byte length. `file` identified PDF 1.4, and `pdfinfo` reported 226 pages, an Adobe InDesign creator, an embedded creation date of 2026-01-22, and an embedded modification date of 2026-04-01.

Embedded PDF dates are document metadata, not proof of publication date, effective date, municipal approval, or current validity. The inventory therefore does not populate those lifecycle fields.

## Feature 054 boundary

Legacy artifacts exist at `artifacts/pdm_ot_sections.jsonl` and `artifacts/pdm_ot_sections.sql`, and the legacy extraction note reports 224 text-bearing page sections. Those artifacts predate the controlled Feature 054 workflow. They do not establish a controlled acquisition, a successful current index operation, or a matching `.rag/corpus-manifest.json` record.

Consequently, `antigua-pdm-ot` deliberately has no `acquisition`, `extraction`, or `indexing` object. Promotion requires:

1. import of the raw PDF through Feature 054 into its bounded library root;
2. raw-byte hash verification against the recorded SHA-256;
3. reconciliation of the legacy extraction, or a new extraction through the current boundary;
4. successful indexing and a matching operational corpus manifest before `ingested` is claimed.

### Controlled import dry-run evidence

The Feature 054 importer was executed with `--dry-run` against the verified local PDF and the
version `official-municipal-pdf-2026-06-22`. It returned `status: "planned"`, reproduced the
recorded SHA-256, selected the bounded destination
`.rag/library/antigua-pdm-ot/antigua-pdm-ot--official-municipal-pdf-2026-06-22.pdf`, reported no
failures, and confirmed `mutated: false`. This proves that the controlled transition can be
planned; it does not prove that the copy, extraction, indexing, or manifest reconciliation has
occurred.

## Reproduce the checks

```bash
npm run source-inventory:validate
node --import tsx --test src/__tests__/pdm-source-inventory-reconciliation.test.ts
```

When the optional local PDF is present, the focused test also verifies its raw-byte SHA-256, byte length, and PDF header. In a clean clone without the Git-ignored raw artifact, that byte-level check is explicitly skipped while the portable manifest, download-log, and seed reconciliation still run.
