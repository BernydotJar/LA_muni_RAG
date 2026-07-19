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
- optional media type;
- dry-run flag.

Behavior:

- require an existing inventory record;
- reject `missing_source`, `ingested`, and `superseded` records;
- read raw bytes and calculate SHA-256 over those bytes;
- fail closed when the declared version conflicts;
- fail closed when the same source/version already has a different acquired hash;
- copy to a deterministic path below the configured library root;
- update the record to `acquired` only after a successful copy;
- repeat of the same source/version/hash is an idempotent no-op;
- dry-run performs validation and planning only.

### Ingest acquired artifact

Inputs:

- source inventory path;
- operational corpus manifest path;
- source id;
- dry-run flag.

Behavior:

- require acquisition evidence and an existing local artifact;
- recalculate raw-byte SHA-256 and compare with inventory;
- map inventory authority metadata to a valid domain-pack authority id;
- extract and index through the existing vector indexing boundary;
- write the operational corpus manifest only after a successful index result;
- mark the inventory record `ingested` only after extraction/index evidence and manifest reconciliation are valid;
- repeat of an already reconciled source/version/hash is an idempotent no-op;
- dry-run never invokes the indexer and never writes either manifest.

## State boundaries

- `verified` is not `acquired`.
- `acquired` requires a local artifact plus raw-byte SHA-256.
- `ingestion_pending` requires acquisition evidence.
- `ingested` requires acquisition, extraction, indexing, positive section/chunk counts, and operational manifest reconciliation.
- publication or legal approval is outside this feature.

## Security and safety

- no network downloader;
- no path may escape the configured library root;
- no secrets, tokens, credentials, database URLs, or provider endpoints in reports;
- Mixco and other municipalities remain comparative for Antigua;
- national law does not prove Antigua internal procedure;
- no War Room, deployment, migration, auth, profiling, or targeting changes.

## Acceptance criteria

- import and ingest support dry-run;
- identical repeated operations are idempotent;
- version/hash conflicts fail closed;
- binary artifacts use raw-byte hashing;
- failed indexing does not mark inventory `ingested`;
- successful ingestion produces matching inventory and operational-manifest evidence;
- focused and adversarial tests pass;
- typecheck, build, domain evaluation, full suite, Pages verification, diff integrity, and generated-state cleanup pass;
- PR remains unmerged pending human review.
