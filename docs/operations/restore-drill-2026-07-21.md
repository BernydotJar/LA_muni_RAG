# Disposable logical restore drill — 2026-07-21

Status: verified for an isolated disposable PostgreSQL logical database restore;
not production recovery evidence

## Scope

The drill used PostgreSQL 15.18 and pgvector 0.8.5. It backed up the disposable
`la_muni_rag_test` database with a custom-format logical dump and restored into a
distinct, initially empty `la_muni_rag_restore_target` database. Service aliases
were supplied through a mode-`0600` libpq service file. No connection URL or
password was recorded in the receipt.

```text
run_id: restore-drill-20260721-004
started_at: 2026-07-21T21:34:32.605Z
backup_completed_at: 2026-07-21T21:34:34.109Z
restore_completed_at: 2026-07-21T21:34:34.383Z
verified_at: 2026-07-21T21:34:35.860Z
dump_bytes: 247645
dump_sha256: 40053845292b75c35e1b21213e7b2f97b24b1ff5a60ff031d3f4a4fd20f6f923
metadata_receipt_sha256: e708154bba677730c11ecab8ac09f2a1723da7dbb54be3f8d34bcdbc4a8be604
result_receipt_sha256: 00d6aa2c25d4d3217bed44e044e3cc679860770a2e8914d42336b9b482edca03
```

## Results

- source and target identities were distinct;
- the target contained no non-system tables before restore;
- the dump checksum was verified before restore;
- `pg_restore --list` contained all five application schemas;
- restore used `--exit-on-error --single-transaction --no-owner --no-acl`;
- schema, extension, table/RLS state, constraints, policies, indexes and function
  catalog fingerprint were equal;
- bounded table counts/content hashes were equal;
- all retained dump, checksum, manifest, metadata and result files were `0600`
  inside a `0700` directory;
- reviewed disposable runtime grants were re-applied after the ACL-free restore;
- the runtime role remained `NOSUPERUSER` and `NOBYPASSRLS`;
- forced RLS and cross-tenant denial remained effective;
- compiled application smoke returned
  `procedure_case_postgres_http_smoke_passed`, including authenticated success,
  cross-tenant denial, exact replay and corrupt-transport recovery.

Safe fingerprint receipts:

```text
catalog fingerprint: equal
source/target: 544d06d73aa550cc6bb235139001c4f852d7c3f0c89d6975f6395259f0bce019

table-data fingerprint: equal
source/target: b6fede1be8e35ef0a72aef1861d81a80444943867495b082c1dd01229ec1bd3e
```

The database dump and restored database remained outside Git and are not product
artifacts.

## Explicitly not proved

- external object restore: not tested;
- physical backup or point-in-time recovery: not tested;
- encryption/KMS recovery and remote immutable storage: not tested;
- production credentials, provider snapshots or production topology: not used;
- production RPO/RTO: not defined or measured;
- large-corpus duration/capacity: not measured;
- staging restore: not completed;
- two-human review/sign-off: not completed;
- promotion or disaster-recovery cutover: not attempted.

This drill demonstrates executable logical recovery mechanics and recovered
application access in a disposable environment. It does not authorize production
deployment or satisfy the full backup/object/PITR program.
