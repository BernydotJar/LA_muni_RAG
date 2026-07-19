# Document Library and Ingestion Operations

Feature 054 adds bounded local-artifact operations on top of the Feature 053 source inventory.

## Import a local artifact

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

Apply:

```bash
npm run document-library -- import \
  --inventory .rag/source-inventory.json \
  --source-id SOURCE_ID \
  --input /absolute/path/document.pdf \
  --library-root .rag/library \
  --document-version VERSION \
  --media-type application/pdf
```

Import computes SHA-256 over raw bytes, copies the artifact to a deterministic path below the library root, verifies the copied hash, and only then changes the inventory state to `acquired`.

## Ingest an acquired artifact

Dry-run:

```bash
npm run document-library -- ingest \
  --inventory .rag/source-inventory.json \
  --corpus-manifest .rag/corpus-manifest.json \
  --source-id SOURCE_ID \
  --dry-run
```

Apply:

```bash
npm run document-library -- ingest \
  --inventory .rag/source-inventory.json \
  --corpus-manifest .rag/corpus-manifest.json \
  --source-id SOURCE_ID
```

Ingestion verifies the artifact hash, extracts sections, invokes the existing vector indexer, writes a matching operational-manifest record, reconciles both manifests, and only then marks the inventory record `ingested`.

## Required runtime configuration

A real ingestion requires the same embedding-provider and vector-store configuration as the existing indexing pipeline. Missing configuration returns a failed operation and does not mark the inventory record as ingested.

## Idempotency

- Reimporting the same source/version/hash returns `noop`.
- Reingesting an already reconciled source/version/hash returns `noop`.
- Reusing a source/version with a different hash fails closed.

## Safety boundaries

- No network download is performed.
- Dry-run does not copy, index, or write manifests.
- Artifact paths are constrained below the configured library root.
- A URL does not prove acquisition.
- Acquisition does not prove ingestion.
- Ingestion does not prove publication, legal approval, or institutional adoption.
- Mixco and other municipalities remain comparative for Antigua Guatemala.
