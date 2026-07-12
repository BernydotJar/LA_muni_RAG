# Domain Pack Ingestion Metadata

Feature: `043-domain-pack-ingestion-metadata`  
Status: MVP

## Purpose

Corpus backfill can now attach validated domain metadata to every indexed document. This keeps the reusable RAG template evidence-first: documents are not only chunks of text, they carry the domain pack and source authority needed for retrieval, workflow composition, audit, and future admin review.

## CLI Example

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/hr/employee-handbook.md \
  --document-key hr-employee-handbook \
  --document-version 2026-01 \
  --source-format markdown \
  --domain-pack hr \
  --source-authority-class employee_handbook \
  --document-type handbook \
  --jurisdiction "People Operations" \
  --organization "Example Organization" \
  --confidentiality internal \
  --tag onboarding \
  --tag benefits
```

If `--domain-pack` is omitted, the default is:

```text
municipal-antigua
```

## Validation

- Unsupported domain packs fail closed.
- `--source-authority-class` must exist in the selected pack.
- `--confidentiality` must be `public`, `internal`, or `restricted`.
- `--document-type` defaults to the detected source format.
- `--source-authority-class` defaults to `unknown`.

## Manifest Behavior

The corpus manifest now stores `documentMetadata` on each record. Metadata-only corrections trigger reindex so stale authority or domain labels are not silently skipped.

Existing manifest files remain readable because the new field is optional.

## Database Boundary

No database migration was added. Metadata travels through the existing ingestion and embedding metadata path and remains compatible with the current schema.
