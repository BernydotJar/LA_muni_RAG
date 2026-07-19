# Ingestion runbook

Status: pre-production local workflow; bounded raw-PDF process isolation exists,
while an authenticated library, durable jobs, production scanner/storage,
approved OS sandbox, and tenant-safe indexing remain incomplete.

## Preconditions

Before any operation, confirm:

- the source inventory record and declared version were reviewed;
- authority, jurisdiction, public URL, provenance, confidentiality, and
  limitations are explicit;
- the input is operator-controlled and no network download occurs implicitly;
- `.rag/library` and `.rag/quarantine` are access-restricted, ignored local roots;
- library and quarantine roots reside on the same filesystem so no-replace
  hard-link moves can fail closed;
- an approved ClamAV runtime and current definitions are available for applied
  inspection;
- raw-PDF byte/page/text/time/memory/concurrency policy is reviewed for the
  selected runtime and remains within compiled ceilings;
- embedding/vector configuration is test or production-shaped for any later
  indexing attempt.

Do not proceed with a changed URL response under an existing version. Register a
new reviewed version rather than overwriting expected acquisition identity.

## Standard flow

1. Run `import --dry-run` with explicit MIME type. Review source/version, planned
   path, SHA-256, and zero mutations.
2. Apply `import`. Reread the JSON result and inventory. Require `imported` or an
   expected identical `noop`; do not interpret `acquired` as safe or valid.
3. Run `inspect --dry-run`. A scanner error or infected verdict exits nonzero and
   predicts quarantine without moving bytes.
4. Apply `inspect` only when the scanner runtime and quarantine root are approved.
   Require `accepted` and clean matching evidence before continuing.
5. Reconcile internal title/version/approval/effective-date evidence through human
   review. A clean scan is not documentary approval.
6. Run `ingest --dry-run`. Require positive extracted sections and zero writes.
7. Apply ingestion only after the extractor, tenant-safe vector writer, database,
   and operational manifest are production-shaped and approved.
8. Validate source inventory and corpus-manifest reconciliation, then run retrieval
   and citation fidelity evaluations before promotion to user-facing evidence.

Command syntax and configuration are maintained in
[Document Library and Ingestion Operations](../document-library-operations.md).

## Quarantine and retry

For `quarantined`:

1. stop extraction/indexing for the source/version;
2. preserve the JSON result, expected hash, observed hash when available, scanner
   engine/definition version, detection name, and stable failure codes;
3. do not upload suspicious bytes to tickets or public malware services;
4. for scanner infrastructure failure with unchanged bytes, repair the scanner and
   rerun `inspect` using the same roots;
5. for hash/size drift, recover verified original bytes or create a new reviewed
   version; never rewrite expected acquisition evidence to the observed bytes;
6. for a malware verdict, follow incident response and obtain Security approval
   before any release from quarantine.

The file-based move is locally reversible and attempts rollback if manifest write
fails. It is not a durable object-storage quarantine, retention policy, immutable
audit trail, or substitute for restricted storage IAM.

## Stable failure classes

| Class | Examples | Operator action |
|---|---|---|
| structural | `artifact_signature_mismatch`, `artifact_size_exceeded` | verify source and version; do not extract |
| acquisition drift | `artifact_acquisition_hash_mismatch`, `artifact_acquisition_size_mismatch` | recover expected bytes or register a new version |
| scanner unavailable | `malware_scanner_unconfigured`, `malware_scanner_unavailable`, `malware_scanner_timeout` | restore scanner health; retry unchanged quarantine bytes |
| detection | `malware_detected` | preserve quarantine; start Security/incident review |
| race/tamper | `artifact_changed_during_import`, `artifact_changed_during_scan`, `artifact_scan_snapshot_changed` | isolate operator/storage path and investigate |
| storage topology | `artifact_roots_cross_device` | place managed roots on one approved filesystem; do not copy around the gate |
| freshness | `artifact_safety_evidence_stale` | rescan before extraction |
| PDF structure/content | `pdf_malformed`, `pdf_encrypted`, `pdf_no_extractable_text` | preserve evidence; recover an approved source or use a separately reviewed OCR flow |
| PDF resource bound | `pdf_timeout`, `pdf_*_limit_exceeded`, `pdf_worker_*` | stop the source/version and investigate parser/runtime capacity or hostile input |

## Current DMP pilot state

`antigua-mnp-dmp-v3-2026` remains only `acquired`. Its original bytes and SHA-256
are controlled locally, but no clean ClamAV evidence, section extraction, vector
index, corpus-manifest record, approval, current-validity decision, or reuse
license is claimed. Do not run `ingest` merely because the structural PDF import
check passes.

## Production blockers

- authenticated tenant-scoped library/upload/API and RBAC;
- source URL acquisition policy and egress controls;
- durable object storage with restricted quarantine IAM and retention;
- monitored scanner service, definition freshness alert, and scan-capacity test;
- approved OS/container isolation and native-memory/load testing for the bounded
  PDF parser process;
- transactional tenant-scoped vector writes, job retries/locks, and append-only
  audit;
- staging corrupt-file, decompression-bomb, concurrency, restore, and incident
  exercises.
