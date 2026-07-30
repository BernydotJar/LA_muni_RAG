# ADR 065 — Logical backups exclude ownership and ACLs

Status: accepted for the disposable restore gate

## Decision

Use PostgreSQL custom-format dumps with `--no-owner --no-acl`. Restore into a
new empty database with `--exit-on-error --single-transaction`. Platform/database
provisioning reapplies reviewed roles and grants after restore.

## Rationale

Restoring source ownership and grants into a new environment can silently grant
unexpected access or depend on unavailable principals. Separating data/schema
recovery from runtime provisioning makes the trust boundary observable and lets
the restore gate prove that the runtime role remains non-owner and cannot bypass
forced RLS.

## Limitations

This decision covers logical PostgreSQL recovery only. It does not select a
production backup provider, encryption key strategy, PITR, object-store snapshot,
RPO/RTO or disaster-recovery promotion process.
