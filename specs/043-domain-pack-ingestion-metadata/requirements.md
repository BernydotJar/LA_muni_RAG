# Requirements — Domain Pack Ingestion Metadata

## Objective

Make corpus backfill metadata domain-aware so documents can be indexed with explicit domain pack, source authority, document type, jurisdiction, organization, confidentiality, and tags.

## Acceptance Criteria

- AC-01: `backfillCorpus` accepts `--domain-pack`, defaulting to `municipal-antigua`.
- AC-02: Unsupported domain packs fail closed before manifest writes or indexing.
- AC-03: Optional `--source-authority-class` must exist in the selected domain pack when provided.
- AC-04: Optional `--confidentiality` must be one of `public`, `internal`, or `restricted`.
- AC-05: Domain document metadata is passed into vector indexing document metadata.
- AC-06: The corpus manifest records validated domain document metadata for audit and reindex decisions.
- AC-07: Changing domain document metadata triggers reindex.
- AC-08: Dry-run output exposes safe domain metadata without secrets.
- AC-09: Existing CLI invocations without new flags keep working with `municipal-antigua`.
- AC-10: No database migration is required.
- AC-11: Generated `dist-pages/` is not modified or committed.

## Non-Goals

- Build a document-library/admin UI.
- Change PostgreSQL schema.
- Upload or delete corpus files.
- Promote feedback into evidence.
