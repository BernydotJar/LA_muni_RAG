# Traceability — Feature 085 controlled real corpus ingestion v1

| Requirement | Implementation | Evidence |
|---|---|---|
| Reuse the existing ingestion runtime | Persisted artifact acceptance, `PostgresIngestionJobService`, `TenantIngestionWorker`, `TenantPgVectorRepository` | `src/cli/controlledCorpusIngestion.ts` |
| Exact public-source acquisition | Allowlisted HTTPS downloader with manual redirects and exact size/hash checks | `scripts/acquire-controlled-real-corpus.mjs` |
| Raw bytes outside Git | `.rag/library/` exclusion and verifier rejection of tracked raw artifacts | `.gitignore`, `src/cli/verifyControlledCorpusEvidence.ts` |
| Malware and structural gate | ClamAV plus bounded structural inspection bound to exact bytes | controlled ingestion receipt and named EVAL |
| Tenant isolation | Separate admin/runtime connections, non-owner `NOBYPASSRLS` role, five `FORCE RLS` tables | `db/tests/controlled_real_corpus_setup.sql`, end-to-end harness |
| Canonical vector identity | Server-owned document key/title/version included in the lease and rechecked at completion | `jobTypes.ts`, `ingestionJobService.ts`, `ingestionWorker.ts`, worker regression |
| Real PDM-OT ingestion | 224 sections and 444 tenant-scoped chunks | `evals/real-corpus/results/controlled-ingestion-receipt.json` |
| Honest scanned-PDF handling | DMP v3 remains failed with `pdf_no_extractable_text`; no OCR or chunks credited | receipt, inventory and independent review |
| No semantic/provider overclaim | Explicit `local-eval-hashing/token-bigram-hash-1536-v1`, `semanticClaim: false` | provider, receipt and verifier |
| Durable reconciliation | Source inventory plus committed evidence manifest and receipt | `.rag/source-inventory.json`, `evals/real-corpus/controlled-corpus-manifest.json` |
| Deterministic verification | Source validator, evidence verifier, 10-case named EVAL and full regression | package scripts and Backend CI |

## Acceptance summary

The controlled corpus contains one real ingested municipal document and one exact, clean municipal scan blocked before extraction. This closes the prior zero-ingestion claim without converting a scan failure into fictitious corpus evidence.
