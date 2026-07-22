# Requirements Traceability — Feature 054

| Requirement | Implementation | Verification |
|---|---|---|
| Import only operator-provided local artifacts | `importLocalArtifact` in `src/sources/documentLibraryOperations.ts` | `document-library-operations.test.ts` import cases |
| No network acquisition | No downloader or HTTP client added; CLI accepts a local `--input` path | Scope audit and changed-file list |
| Hash binary artifacts as raw bytes | `sha256Bytes(Buffer)` | Binary fixture assertion in focused tests |
| Bind extension, declared MIME, and byte signature before acquisition | `inspectArtifactContent` for PDF/DOCX/TXT/Markdown | structural safety and false-MIME import tests |
| Bound artifact size before full processing | `lstat` plus `DOCUMENT_MAX_ARTIFACT_BYTES` | policy-bound and size-rejection tests |
| Constrain artifacts below library root | `boundedArtifactPath` with sanitized segments and resolved-root check | Static review and focused import coverage |
| Dry-run import performs no writes | `input.dryRun` planning branch | Inventory remains byte-for-byte unchanged test |
| Dry-run inspection performs no moves or writes | scanner runs before the `input.dryRun` result branch | infected dry-run leaves inventory/artifact unchanged test |
| Dry-run ingestion performs no indexing or writes | `input.dryRun` branch before index call | Index call count remains zero test |
| Repeated identical import is idempotent | Existing acquisition hash returns `noop` | Repeated import test |
| Repeated completed ingestion is idempotent | Reconciled inventory/manifest match returns `noop` | Repeated ingestion test |
| Same source/version with different hash fails closed | Acquisition and operational-manifest conflict checks | Different-hash import test |
| Acquisition requires copied artifact and verified hash | Copy, reread and copied-hash verification before inventory write | Successful binary import test |
| Import cannot overwrite a deterministic destination or copy swapped input bytes | validated buffer is written with `wx` to staging, verified, then renamed only when destination is absent | pre-existing destination remains byte-identical test |
| Scanner execution must not use a shell or arbitrary argument string | fixed ClamAV modes/arguments through bounded `execFile` | command-runner and config rejection tests |
| Scanner must inspect the verified bytes rather than a mutable path | private snapshot from verified buffer; pre/post snapshot hash; clamd stream mode | ABA managed-path and snapshot-tamper tests |
| Missing/error/infected scanner result blocks extraction | `inspectLibraryArtifact` failure evidence plus quarantine move | missing-scanner, infected, and zero-extractor-call tests |
| Quarantine retains expected identity and observed drift | bounded deterministic quarantine path plus separate expected/observed hash/size | tampered-byte quarantine test |
| Clean retry restores unchanged transient failures | original bounded path is retained in failure evidence | missing-scanner then clean-retry test |
| Ingestion requires matching current clean safety evidence | `hasCleanArtifactSafety` plus 24-hour default age gate | no-safety and stale-safety zero-extractor tests |
| Extraction/indexing receives the exact verified buffer/document | document library extracts the post-scan buffer once and supplies both bytes and normalized object | vector no-reread and document-library object-identity tests |
| Ingestion requires positive extraction | Section count must be a positive integer | Dry-run and successful-ingestion tests |
| Ingestion requires successful indexing | Indexed status, positive chunks and zero failures required | Failed-indexing test |
| Inventory and operational manifest must reconcile | `reconcileSourceInventoryWithCorpusManifest` before inventory write | Successful ingestion and manifest assertions |
| Failed indexing cannot mark inventory ingested | Inventory write occurs after successful index and reconciliation | Inventory remains unchanged test |
| Authority metadata remains valid | `sourceInventoryRecordToDomainMetadata`; `DomainDocumentMetadata` is indexable | Authority and source-inventory regression suites |
| Reports must avoid sensitive runtime values | `sanitizeFailureMessage` plus existing indexer sanitization | Code review and full regression suite |
| CLI must support import, inspect, and ingest | `src/cli/documentLibrary.ts`; `npm run document-library` | CLI parser plus focused operation tests |
| Real DMP structural identity remains non-mutating | actual acquired PDF passed import signature/MIME/hash and returned `noop` | local `import --dry-run` result: zero failures, zero sections/chunks, `artifactSafety: null` |
| Existing product behavior must remain intact | No public UI, migration, War Room or deployment behavior changed | Full test suite, Pages build/verifier and scope audit |
| Generated state must be clean | CI removes diagnostic and Pages outputs | `Verify clean generated state` step |
| Human approval remains required | No deployment is authorized by this feature or its tests | Program production gate and release review record |

## Residual risks

- Inventory and operational manifest writes are separate file operations; reconciliation detects divergence but does not provide a distributed transaction.
- Cross-process locking is not implemented; operator runs must be serialized until a later locking or compare-and-swap feature.
- The repository has a ClamAV adapter but no installed/monitored scanner runtime or definition-freshness alert; real artifacts therefore remain unaccepted.
- Feature 055 now provides bounded raw-PDF extraction, but it is not a complete OS sandbox and the real DMP remains uninspected and unparsed.
- File quarantine is local and ignored, not durable object storage with restricted IAM, retention, backup, or incident-tested recovery.
