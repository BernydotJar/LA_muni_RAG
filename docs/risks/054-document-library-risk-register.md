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
