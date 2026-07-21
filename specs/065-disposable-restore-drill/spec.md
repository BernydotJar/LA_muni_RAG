# Feature 065 — Disposable logical restore drill v1

Status: implemented and executed locally; detached and remote CI pending

## Objective

Turn the existing backup/restore runbook into an executable, safe and auditable
logical PostgreSQL restore gate without claiming production disaster recovery.

## Acceptance criteria

1. Connections use libpq service aliases and protected service/password files,
   not credential-bearing URLs.
2. Source and restore target are distinct and the target is empty.
3. Backup uses custom format, no owner/ACL, mode `0600` artifacts and SHA-256.
4. The manifest contains every application schema.
5. Checksum is revalidated before restore.
6. Restore is single-transaction and exits on the first error.
7. Source and target catalog fingerprints match for extensions, schemas,
   table/RLS state, constraints, policies, indexes and functions.
8. Bounded row counts/content hashes match without writing row content to logs.
9. Reviewed runtime grants are re-applied separately after ACL-free restore.
10. Runtime role remains non-owner, `NOSUPERUSER`, `NOBYPASSRLS`; forced RLS and
    cross-tenant denial remain effective.
11. A compiled authenticated application smoke passes against the restored DB.
12. Object storage, PITR, production RPO/RTO, staging and human sign-off remain
    explicit non-proofs.
13. Receipts contain safe hashes/timings only and recovered data is not committed.

## Security

The script rejects unsafe aliases/run IDs, same-database restore, non-empty target,
loose credential-file permissions and pre-existing run directories. It never
uses a shell, never prints command arguments and never consumes `DATABASE_URL`.

## Rollback

The drill creates a new isolated database and artifact directory. Disposal of the
disposable target and local drill artifacts is performed only after evidence is
recorded. The script never uses `--clean` and never restores over an existing DB.
