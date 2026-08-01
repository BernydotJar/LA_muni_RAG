# Feature 090 — Critic / Red Team review

## Scope

Reviewed the plan, network policy, scanner boundary, immutable storage, HTML extraction, inventory transitions, live receipt and byte-verification report for `WS02-OFFICIAL-SOURCE-ACQUISITION-003`.

## Findings and repairs

### RT-090-01 — DNS validation/connect time-of-check gap

**Severity:** high  
**Status:** fixed

A preliminary implementation validated public DNS addresses and then used the global `fetch`, which could resolve the hostname again. A configurable tenant host could exploit DNS rebinding between validation and connection.

**Repair:** the production path now creates an Undici dispatcher whose lookup callback returns only the previously validated public addresses. TLS still uses the original hostname and SNI. Every redirect hop is resolved and pinned again. Injected fetch functions exist only for deterministic tests.

### RT-090-02 — Private-network and documentation ranges

**Severity:** high  
**Status:** fixed and tested

Loopback, RFC1918, link-local, carrier-grade NAT, benchmark, documentation, multicast and reserved IPv4 ranges, plus IPv6 loopback, ULA, link-local, multicast and documentation ranges, must not be reachable.

**Repair:** all are rejected before request dispatch. Tests demonstrate that fetch is never invoked for a private result.

### RT-090-03 — Symlink and concurrent publication

**Severity:** high  
**Status:** fixed and tested

Recursive directory creation and rename-based publication could follow an internal symlink or overwrite a target created concurrently.

**Repair:** library components are created and inspected one by one; symlinks and non-directory components fail closed. Content is written mode 0600 to a temporary file and published with a no-overwrite hard link. Existing targets are reusable only after regular-file, size and SHA-256 equality checks. A symlink attack writes no bytes outside the root.

### RT-090-04 — Legacy HTML confused with arbitrary binary data

**Severity:** high  
**Status:** fixed and tested

Accepting Latin-1 generically would make almost any byte sequence decodable.

**Repair:** legacy decoding is permitted only for `.html`/`.htm`, only when ISO-8859-1 or Windows-1252 is explicitly declared, only without NUL bytes or excessive controls, and only when recognizable HTML structure is present. Raw source bytes are never transcoded before hashing or scanning.

### RT-090-05 — Minimal or anti-bot response promoted as source

**Severity:** medium  
**Status:** fixed and observed live

An HTTP 200 response can contain a challenge shell, empty page or portal stub.

**Repair:** acquisition requires bounded structural inspection plus minimum extracted text and sections. Two Congreso endpoints returned 212-byte shells and were blocked as `source_extraction_insufficient` with zero sections and zero extracted characters.

### RT-090-06 — Incomplete scanner evidence

**Severity:** high  
**Status:** fixed and tested

A missing scanner, scan error, infected verdict or clean result without definitions identity must not publish bytes.

**Repair:** the CLI requires a real ClamAV adapter. The engine requires `clean`, engine/version and definitions version. The live run used ClamAV 1.4.3 with definitions `28078/Fri-Jul-31-06:24:10-2026`. Infected and scanner-error paths are deterministic blockers.

### RT-090-07 — Oversized response error misclassified

**Severity:** medium  
**Status:** fixed

Undici can reject a decompressed body at its own maximum before the streaming reader emits the explicit size error.

**Repair:** `UND_ERR_RES_EXCEEDED_MAX_SIZE` and equivalent messages map to `source_body_too_large`, preserving a stable receipt code.

### RT-090-08 — Invalid calendar date in content-addressed path

**Severity:** low  
**Status:** fixed and tested

A regex-only date check accepted values such as `2026-02-30`.

**Repair:** plan validation now performs a round-trip UTC calendar validation.

### RT-090-09 — Unauthorized lifecycle overwrite

**Severity:** high  
**Status:** fixed and tested

A plan could otherwise reacquire an `ingested`, `failed` or superseded record and overwrite its lifecycle evidence.

**Repair:** only `verified`, `acquisition_pending` and `ingestion_pending` records are eligible. Success ends at `ingestion_pending`; no indexing object is created. Blocked sources record identical before/after status.

### RT-090-10 — Historical test froze sources at discovery state

**Severity:** medium  
**Status:** fixed

Feature 089 tests required all nine newly discovered sources to remain `verified` forever, preventing an authorized successor from adding governed acquisition evidence.

**Repair:** the historical test now permits only `verified` or fully evidenced `ingestion_pending`, and continues to reject implicit indexing or ingestion.

## Live attack/result matrix

| Condition | Result |
| --- | --- |
| 16 governed source-pack bindings attempted | 16 receipts |
| Clean, structurally useful snapshots | 11 acquired |
| HTTP 403 | 3 blocked with `source_http_status` |
| 200 response with no extractable content | 2 blocked with `source_extraction_insufficient` |
| Raw bytes in Git | none; `.rag/library` remains ignored |
| Malware verdict | 11 clean; zero infected |
| Indexed or projected by this node | zero |
| Managed database mutation | zero |

## Residual risks and blockers

- `guatemala-procurement-regulation`, `guatemala-mafim-second-edition` and `mspas-water-health-authority` return HTTP 403 to the governed automated client. Browser-assisted or authority-provided immutable acquisition requires a separate approved workflow.
- `gt-codigo-municipal-index` and `guatemala-development-councils-law` return non-substantive portal shells. Their linked canonical documents must be located and acquired separately.
- HTML pages can contain navigation and presentation boilerplate. All 11 snapshots remain `ingestion_pending`; applicability review and citation-quality evaluation are required before indexing.
- The acquisition captures a dated snapshot, not a legal opinion on vigencia or applicability.
- The local immutable library is not yet a managed tenant object store. Backup, retention and production access controls remain outside this node.

## Critic conclusion

The implementation is suitable for independent verification. It converts governed discovery records into scanned, reproducible local acquisition evidence while preserving every indexing, legal and deployment boundary.
