# Domain Pack Admin Intake

Feature: `045-domain-pack-admin-intake`  
Status: MVP

## Purpose

`/domain-intake.html` is a local preparation surface for domain-aware document ingestion. It helps an operator assemble metadata and a `backfillCorpus` command before indexing a document.

## What It Does

- Loads active domain metadata from `/api/domain-pack`.
- Lists source authority classes from the active pack.
- Builds a `DomainDocumentMetadata` JSON preview.
- Builds a shell command for `src/cli/backfillCorpus.ts`.
- Provides a copy-command button.

## What It Does Not Do

- It does not upload files.
- It does not execute backfill.
- It does not write to PostgreSQL.
- It does not persist intake data.
- It does not promote feedback into evidence.
- It does not expose tokens or database URLs.

## Workflow

1. Open `/domain-intake.html`.
2. Confirm the active pack shown in the header.
3. Fill source path, document key, version, authority class, document type, confidentiality, and tags.
4. Review the JSON metadata preview.
5. Copy the generated command.
6. Run the command in a trusted local terminal after source and confidentiality review.

## Boundary

This is an MVP operator aid, not a complete document-library/admin UI.
