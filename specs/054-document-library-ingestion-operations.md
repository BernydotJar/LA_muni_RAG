# Feature 054 — Document Library and Ingestion Operations

## Goal

Provide bounded operator-facing operations for importing local documentary artifacts into a controlled library and ingesting them through the existing RAG indexing pipeline without conflating discovery, verification, acquisition, extraction, indexing, or publication.

## Dependencies

- Feature 053 source inventory contracts and authority safeguards.
- Existing extractor registry and vector indexing boundary.
- Existing operational corpus manifest store.

## Operations

### Import local artifact

Inputs:

- source inventory path;
- source id;
- local input path;
- bounded library root;
- document version;
- required declared media type;
- dry-run flag.

Behavior:

- require an existing inventory record;
- reject `missing_source`, `ingested`, and `superseded` records;
- reject empty/oversized, unsupported, extension/MIME-mismatched, or structurally mismatched bytes;
- read raw bytes and calculate SHA-256 over those bytes;
- fail closed when the declared version conflicts;
- fail closed when the same source/version already has a different acquired hash;
- write validated bytes to a non-overwriting staging file, publish with an atomic no-replace hard link to a deterministic path below the configured library root, and then remove the staging name;
- update the record to `acquired` only after a successful copy;
- repeat of the same source/version/hash is an idempotent no-op;
- dry-run performs validation and planning only.

### Inspect acquired artifact

Inputs:

- source inventory path;
- source id;
- bounded library and quarantine roots;
- configured `clamdscan` or `clamscan` runtime;
- dry-run flag.

Behavior:

- require acquisition evidence and a regular non-symlink managed file;
- bind expected and observed path/hash/size/MIME/signature evidence;
- execute only fixed scanner modes/arguments without a shell and with time/output limits;
- record engine, version, optional definition version, timestamp, verdict, and stable failure codes;
- move applied scanner/signature/identity failures below the quarantine root without rewriting expected acquisition identity;
- allow a clean retry to restore unchanged bytes after a transient scanner failure;
- dry-run may scan but never moves bytes or writes the inventory.

### Ingest acquired artifact

Inputs:

- source inventory path;
- operational corpus manifest path;
- source id;
- dry-run flag.

Behavior:

- require acquisition evidence and current matching clean artifact-safety evidence;
- reject missing, stale, future-dated, quarantined, path/hash/size-mismatched, or symlinked evidence before extraction;
- recalculate raw-byte SHA-256 and compare with inventory;
- map inventory authority metadata to a valid domain-pack authority id;
- pass the exact post-scan/hash-verified buffer through the existing extraction and vector indexing boundary without rereading the path;
- write the operational corpus manifest only after a successful index result;
- mark the inventory record `ingested` only after extraction/index evidence and manifest reconciliation are valid;
- repeat of an already reconciled source/version/hash is an idempotent no-op;
- dry-run never invokes the indexer and never writes either manifest.

## State boundaries

- `verified` is not `acquired`.
- `acquired` requires a local artifact plus raw-byte SHA-256.
- `ingestion_pending` requires acquisition evidence.
- `ingested` requires clean artifact-safety, acquisition, extraction, indexing, positive section/chunk counts, and operational manifest reconciliation.
- publication or legal approval is outside this feature.

## Security and safety

- no network downloader;
- no path may escape the configured library or quarantine root;
- scanner absence, timeout, error, or detection fails closed before extraction;
- application size checks do not replace ClamAV archive/decompression limits;
- no secrets, tokens, credentials, database URLs, or provider endpoints in reports;
- Mixco and other municipalities remain comparative for Antigua;
- national law does not prove Antigua internal procedure;
- no War Room, deployment, migration, auth, profiling, or targeting changes.

## Acceptance criteria

- import, inspect, and ingest support dry-run;
- identical repeated operations are idempotent;
- version/hash conflicts fail closed;
- corrupt/tampered bytes are quarantined and never reach the extractor;
- stale clean evidence requires rescan;
- binary artifacts use raw-byte hashing;
- failed indexing does not mark inventory `ingested`;
- successful ingestion produces matching inventory and operational-manifest evidence;
- focused and adversarial tests pass;
- typecheck, build, domain evaluation, full suite, Pages verification, diff integrity, and generated-state cleanup pass;
- PR remains unmerged pending human review.
