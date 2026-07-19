# Risk Register — Feature 054

| ID | Risk | Control | Residual state |
|---|---|---|---|
| R54-01 | Binary artifact hash differs from text-derived hash | SHA-256 is calculated over raw bytes | Controlled |
| R54-02 | Path traversal writes outside the document library | Deterministic sanitized path plus resolved-root boundary | Controlled |
| R54-03 | Dry-run mutates files or invokes indexing | Explicit dry-run branches and focused tests | Controlled |
| R54-04 | Same source/version silently changes content | Existing acquisition and operational hashes are compared; mismatch fails closed | Controlled |
| R54-05 | Failed index operation marks source ingested | Inventory update occurs only after successful indexing and reconciliation | Controlled |
| R54-06 | Operational manifest and inventory diverge if final inventory write fails | Reconciliation detects divergence on subsequent validation; operations fail closed | Open; file-based stores are not a distributed transaction |
| R54-07 | Concurrent operators overwrite file manifests | Atomic rename reduces partial writes but no cross-process lock exists | Open; serialize operator runs until a locking/CAS feature is added |
| R54-08 | Provider or database configuration leaks through reports | Existing indexer sanitization and operation-level redaction | Controlled with tests and review |
| R54-09 | Comparative source is promoted to Antigua authority | Feature 053 authority mapper and boundary tests remain in the execution path | Controlled |
| R54-10 | `ingested` is interpreted as published or legally approved | Runbook, spec and operation result explicitly exclude publication semantics | Controlled |
| R54-11 | Artifact disappears after acquisition | Ingestion re-reads and hashes the local artifact before indexing | Controlled |
| R54-12 | Duplicate extraction creates unnecessary work | Dry-run and idempotent completed-ingestion path reduce repeats; first ingestion extracts before indexing | Accepted |
| R54-13 | Spoofed extension or declared MIME reaches a parser | Import binds supported extension, declared MIME and byte signature before copying | Controlled for PDF/DOCX/TXT/Markdown; full parser validation remains pending |
| R54-14 | Malware or encrypted/over-limit content reaches extraction | Ingestion requires current matching clean scanner evidence; ClamAV errors and detections fail closed | Adapter/test evidence exists; real monitored scanner runtime and definition freshness alert are absent |
| R54-15 | Suspect bytes remain in the active library | Applied failures atomically rename regular files to a bounded ignored quarantine root and mark inventory failed | Local file control only; durable restricted object-storage quarantine and retention are absent |
| R54-16 | File changes between scan and extraction/indexing | Inspection rereads after scan; ingestion rechecks path-bound hash/size/age and passes that exact verified buffer to extraction/indexing | Vector writes and file manifests are not one transaction; cross-process lock/CAS remains absent |
| R54-17 | Scanner command injection or unbounded process output | Fixed scanner modes/arguments, `execFile` without shell, absolute-or-exact executable policy, timeout and output bound | Scanner binary/config provenance and runtime sandbox remain production blockers |
| R54-18 | ClamAV silently skips internal content at configured limits | App size cap; standalone scan enables encrypted and exceeds-limit alerts; clamd policy is an explicit deployment check | `clamd.conf`, decompression-bomb test and capacity threshold are unproven |
| R54-19 | Input path changes between import read and copy | Import writes validated in-memory bytes to a non-overwriting staging file, verifies it, then atomically renames | Fixed staging path requires serialized operators until locking/CAS exists |
