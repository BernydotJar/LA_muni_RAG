# Requirements — Domain Pack Admin Intake

## Objective

Add a local, pack-aware document intake page that helps operators prepare validated metadata and a backfill command before indexing documents.

## Acceptance Criteria

- AC-01: Add a public static page for document intake preparation.
- AC-02: The page must load active pack metadata from `/api/domain-pack`.
- AC-03: The page must populate source authority options from the active pack.
- AC-04: The page must generate a `backfillCorpus` command using domain metadata flags.
- AC-05: The page must generate a metadata JSON preview.
- AC-06: The page must not upload files, write to the backend, persist secrets, or call feedback APIs.
- AC-07: The page must be included in Pages build and verification.
- AC-08: The procedure workflow page must link to the intake page.
- AC-09: Generated `dist-pages/` is not modified or committed.

## Non-Goals

- Build a full document library/admin UI.
- Execute backfill commands from the browser.
- Add authentication.
- Add database migrations.
- Delete, upload, or modify corpus files.
