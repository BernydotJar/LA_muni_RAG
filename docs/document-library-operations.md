# Document Library and Ingestion Operations

Feature 054 provides a local operator workflow above the source inventory. It is
not yet an authenticated HTTP document library, URL-acquisition service, durable
worker, or production object store. A durable tenant job/vector core now exists
under Feature 056, but this file-backed CLI is not wired to it.

The workflow has three separate gates:

1. `import` records controlled acquisition after size, extension, declared MIME,
   byte-signature, copy, and SHA-256 checks;
2. `inspect` invokes a configured ClamAV scanner and records versioned safety
   evidence or moves the artifact to a bounded quarantine root;
3. `ingest` refuses to call any extractor unless clean evidence matches the
   current path/hash/size/media type and is no more than 24 hours old by default.

Acquisition is not safety acceptance, and safety acceptance is not extraction,
legal approval, publication, validity, or ingestion.

## 1. Import a local artifact

Dry-run:

```bash
npm run document-library -- import \
  --inventory .rag/source-inventory.json \
  --source-id SOURCE_ID \
  --input /absolute/path/document.pdf \
  --library-root .rag/library \
  --document-version VERSION \
  --media-type application/pdf \
  --dry-run
```

Apply uses the same command without `--dry-run`.

Import requires an explicit media type. It rejects unsupported extensions,
empty/oversized files, an extension/MIME disagreement, and bytes whose signature
does not match PDF, DOCX, TXT, or Markdown expectations. PDFs require a header at
the beginning and an EOF marker; this is structural validation, not malware
analysis or proof that the document parses correctly.

After validation, import computes SHA-256 over the original bytes, writes that
validated buffer to a non-overwriting staging file, rereads it, verifies the hash,
publishes with an atomic no-replace hard link to a deterministic path below the
library root, removes the staging name, and only then records `acquired`. An
existing destination is never overwritten. Repeating the same
source/version/hash returns `noop`; a conflicting hash fails closed.

## 2. Inspect and accept or quarantine

Configure one supported scanner mode:

```dotenv
DOCUMENT_MALWARE_SCANNER=clamdscan
DOCUMENT_MAX_ARTIFACT_BYTES=104857600
DOCUMENT_MALWARE_SCAN_MAX_AGE_SECONDS=86400
DOCUMENT_MALWARE_SCAN_TIMEOUT_MS=120000
```

`clamdscan` is preferred for repeated scans. `clamscan` is also supported. An
optional executable override must either be the selected executable name or an
absolute path whose basename is still that scanner; arbitrary binaries, shell
fragments, and scanner arguments are not accepted.
The adapter uses Node `execFile` without a shell, bounds output and runtime, and
maps ClamAV exit codes `0`, `1`, and error states to clean, infected, and failed
verdicts. It scans a private mode-0600 snapshot created from the already verified
buffer instead of the mutable managed path. Snapshot identity is checked before
and after scanning, the managed path is checked again afterward, and `clamdscan`
uses stream mode so the daemon need not open the private path directly.

Dry-run:

```bash
npm run document-library -- inspect \
  --inventory .rag/source-inventory.json \
  --source-id SOURCE_ID \
  --library-root .rag/library \
  --quarantine-root .rag/quarantine \
  --dry-run
```

Apply uses the same command without `--dry-run`. A dry-run may invoke the scanner
but never moves bytes or writes the inventory.

A clean result records:

- current artifact path, expected and observed SHA-256, and expected/observed size;
- declared and detected media type plus structural-signature rule;
- scanner engine, engine version, optional definitions version, inspection time,
  and an empty failure-code list.

Scanner absence, timeout, adapter failure, infection, signature failure, acquired
hash/size drift, or a file changed during scanning fails closed before extraction.
On an applied failure, a regular managed file is published with an atomic
no-replace hard link to a deterministic path below the quarantine root, the
prior managed name is removed, the inventory becomes `failed`, and
stable failure codes are recorded. The original acquisition identity is retained;
observed tampered bytes do not rewrite the expected hash.

For a transient scanner failure with unchanged bytes, rerun `inspect` after the
scanner is healthy. A clean retry moves the artifact from quarantine back to its
original bounded library path and restores `acquired`. Changed bytes cannot pass a
retry under the old source/version/hash; an operator must recover the original
bytes or register a reviewed new version.

The current production container does not install ClamAV. A future approved
runtime must provide `clamdscan` plus a reachable, monitored `clamd` service, or a
reviewed `clamscan` installation with current signed databases. Until then, the
real scanner gate is intentionally unavailable and inspection fails closed.

ClamAV documents that files exceeding its internal limits may otherwise be
skipped. The standalone adapter restricts loading to official databases and
enables encrypted-document and exceeds-limit alerts. For `clamdscan`, equivalent
database, daemon-limit, and alert policy must be reviewed in the selected
`clamd.conf`; application byte limits do not replace scanner
container/decompression limits.

## 3. Ingest an accepted artifact

Dry-run:

```bash
npm run document-library -- ingest \
  --inventory .rag/source-inventory.json \
  --corpus-manifest .rag/corpus-manifest.json \
  --source-id SOURCE_ID \
  --dry-run
```

Apply uses the same command without `--dry-run`.

Before extraction, ingestion rechecks that the file is regular, within the
application size policy, identical to acquisition and clean-scan evidence, and
covered by a non-future scan inside the configured maximum age. Any failure
returns a stable error and calls neither extractor nor indexer.

After that gate, the exact verified in-memory buffer is handed to the existing
extractor once, then the normalized document is handed to indexing without
rereading or reparsing the mutable artifact path. Raw PDFs use the exact locked
PDF.js dependency in a bounded child process with byte/time/page/text/memory/
output/concurrency limits and a strict result protocol. Generic vector and
backfill PDF paths return `pdf_requires_document_library`.

The successful path writes an operational corpus-manifest record, reconciles both
manifests, and only then records `ingested`. A failed extraction or index does not
mark the inventory ingested. See [Raw-PDF Extraction Operations](raw-pdf-extraction.md)
for the policy, stable failures, and residual sandbox limitations.

The default direct vector path now fails with `tenant_ingestion_job_required`;
it never opens a global PostgreSQL writer from `DATABASE_URL`. End-to-end apply
requires a future authenticated adapter/worker that binds current persisted scan
evidence and exact bytes to `PostgresIngestionJobService`. The local dry-run and
injected deterministic tests remain useful, but the acquired DMP must not be used
to bridge this missing integration.

## Failure and recovery rules

- `artifact_*mismatch`, `artifact_changed_during_scan`,
  `artifact_scan_snapshot_*`, `malware_*`, and `pdf_*` codes are
  stable machine-readable outcomes; scanner stdout/stderr and file paths are not
  copied into failure messages.
- Quarantine and library roots must be on the same filesystem for no-replace
  hard-link moves. The operation attempts the same no-replace move in reverse if
  the inventory write fails.
- File manifests still lack cross-process locking/CAS. Serialize operators until
  they are replaced or bound transactionally to the durable job service; the
  database lease does not lock these local JSON files.
- Never delete a quarantined original merely to make a retry green. Preserve
  provenance and follow incident handling for actual malware detections.

See the canonical [ingestion runbook](data/ingestion-runbook.md), the
[Feature 054 decision log](decisions/054-document-library-operations.md), and the
[Feature 054 risk register](risks/054-document-library-risk-register.md). PDF
parser decisions and risks are versioned separately under Feature 055.

Primary implementation references:

- [Node.js `child_process.execFile`](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback)
- [ClamAV one-time scanning](https://docs.clamav.net/manual/Usage/Scanning.html)
- [ClamAV file-type recognition](https://docs.clamav.net/manual/Signatures/FileTypeMagic.html)
