# Backup and restore runbook

Status: pre-production procedure; no production backup or restore drill has been completed
Last reviewed: 2026-07-18
Service owner: Platform/Operations owner pending
Data approval owner: Database owner and Privacy/Legal owner pending

## Recovery decisions

Production is blocked until authorized humans approve measurable objectives and the architecture can meet them.

| Decision | Required value | Current state |
|---|---|---|
| RPO | maximum acceptable data loss by data class | pending human decision |
| RTO | maximum acceptable restoration time by service tier | pending human decision |
| Backup frequency | schedule derived from approved RPO | pending |
| Backup retention | generations, legal hold, and secure deletion | pending Privacy/Legal and Database decision |
| Restore drill frequency | recurring full and targeted tests | pending |
| Storage region/replication | approved locations and failure domains | pending |
| Encryption/key recovery | key owner, rotation, break-glass, escrow/recovery | pending |

This runbook does not invent RPO/RTO values. A backup job that has not been restored and verified is not recovery evidence.

## Recovery scope

A recoverable release must inventory and protect, consistently where required:

- PostgreSQL schemas, extensions, rows, indexes, RLS policies, roles/privilege definitions handled by platform provisioning, and the applied migration ledger once implemented;
- versioned document bytes and extracted artifacts held outside PostgreSQL, with hashes and storage versions;
- source/corpus manifests and approved configuration tied to the release commit;
- immutable application image digest, contract version, and migration source;
- secret-manager configuration and a separately governed credential recovery/rotation process;
- observability/audit data according to its distinct integrity and retention policy.

Git is not a database backup. A database dump is not a backup of external document storage. Secrets must not be embedded in either artifact, and backups must not depend on a credential stored only inside the failed environment.

## Backup controls

- Use a dedicated least-privilege backup identity and encrypted transport.
- Write only to an approved encrypted, access-logged, immutable/versioned destination.
- Restrict restore and download permissions more tightly than routine backup creation.
- Record backup ID, database/service ID, start/end time, PostgreSQL version, release/migration identity, tool version, size, checksum, storage version, encryption key reference, and result.
- Alert on missed, late, incomplete, unexpectedly small/large, checksum-failed, or retention-policy failures.
- Never log or place the database URL/password in a filename, process transcript, ticket, metric label, or command argument visible to other users.
- Coordinate PostgreSQL and external object/document snapshots so provenance references can be reconstructed.
- Do not copy production data to developer laptops or ordinary CI artifacts.

## Logical database backup procedure

The commands below are a reproducible template for an approved isolated operator environment. The platform provisions a read-only libpq service file and password file from the secret manager, each mode `0600`, outside the repository and ordinary logs:

- `LA_MUNI_PGSERVICE_FILE` is a non-secret path to a service file containing a `[la_muni_backup]` alias with host, port, database, backup user, `sslmode=verify-full`, and certificate paths, but no password;
- `LA_MUNI_PGPASS_FILE` is a non-secret path to the libpq password file containing the secret and scoped database identity;
- `LA_MUNI_BACKUP_FILE` and `LA_MUNI_BACKUP_SHA_FILE` point to an approved encrypted staging location.

The operator must not export a credential-bearing connection URL. The only connection string visible in the process list is the non-secret service alias. Never use an unreviewed local directory for production data.

```sh
umask 077
export PGSERVICEFILE="$LA_MUNI_PGSERVICE_FILE"
export PGPASSFILE="$LA_MUNI_PGPASS_FILE"
pg_dump \
  --dbname="service=la_muni_backup" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$LA_MUNI_BACKUP_FILE"

pg_restore --list "$LA_MUNI_BACKUP_FILE"
sha256sum "$LA_MUNI_BACKUP_FILE" > "$LA_MUNI_BACKUP_SHA_FILE"
sha256sum --check "$LA_MUNI_BACKUP_SHA_FILE"
```

Requirements:

1. Fail the job on any non-zero command; do not upload a partial artifact.
2. Capture tool/version and database identity using safe metadata, not the credential-bearing URL.
3. Confirm the manifest contains the expected application schemas and extensions without dumping row content to logs.
4. Upload the dump, checksum, and safe metadata through the approved encrypted mechanism.
5. Confirm object version/immutability and server-side encryption before deleting the encrypted staging copy under the approved disposal procedure.
6. Record the backup receipt in the operations ledger.

Custom-format `pg_dump` is a logical backup. The selected PostgreSQL service may additionally require physical backups and point-in-time recovery to meet the approved RPO/RTO. Provider snapshots do not remove the need for an independent restore test.

## External document/object backup

For each object store or filesystem containing original bytes or extracted artifacts:

1. enable platform versioning/immutability and encryption;
2. export an inventory containing tenant-safe object ID, document/version ID, byte size, SHA-256, storage version, and backup snapshot ID;
3. compare inventory counts and hashes with PostgreSQL references without logging document content or sensitive paths;
4. copy to the approved recovery failure domain using a dedicated identity;
5. alert on missing objects, hash mismatch, unversioned writes, or retention failure.

The current repository has a gitignored local document library, not an approved production object-store design. Its local presence is not backup evidence.

## Restore procedure

### 1. Authorize and isolate

Open a recovery change/incident, name the Incident Commander or Restore owner, define the recovery point, classify the data, and obtain Database plus Security/Privacy approval. Provision a new isolated target with no public ingress, no production outbound integrations, restricted operator access, compatible PostgreSQL version/extensions, and enough capacity. Never test a restore over the active production database.

### 2. Fetch and verify

Retrieve the exact backup object/version and metadata through the approved secure channel. Verify its checksum before attempting restore:

```sh
sha256sum --check "$LA_MUNI_BACKUP_SHA_FILE"
pg_restore --list "$LA_MUNI_BACKUP_FILE"
```

If the checksum, metadata, encryption key, PostgreSQL compatibility, or object inventory is wrong, stop and preserve evidence.

### 3. Restore into an empty target

Provision an empty approved target database. The secret manager provisions a `[la_muni_restore]` entry in the same mode-`0600` libpq service file and a matching entry in the password file. The restore alias must resolve only to the isolated target and use a dedicated restore identity. Then run:

```sh
pg_restore \
  --dbname="service=la_muni_restore" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-acl \
  "$LA_MUNI_BACKUP_FILE"
```

Do not add `--clean` against an existing environment. Ownership and privileges are re-applied through reviewed platform/database provisioning, with a runtime role that does not own tenant tables or bypass RLS.

Restore the matching external document snapshot into an isolated namespace. Validate every referenced version/hash needed by the acceptance sample before starting an application against it.

### 4. Verify without exposing data

Using a read-only verification identity, record only safe aggregate results:

- required extensions and `rag`, `agent`, `audit`, and identity/security schemas exist for the selected release;
- expected tables, constraints, indexes, foreign keys, RLS enable/force settings, and policies match reviewed migrations;
- the migration ledger matches the release (implementation of that ledger is still pending);
- aggregate row/object counts are within the recorded backup expectations;
- document-version and external-object hashes match;
- no required tenant ID is null and cross-tenant negative queries are denied;
- representative keyword/phrase/vector retrieval returns source-version/citation integrity;
- audit and feedback retention timestamps remain coherent;
- the application image for the recovered release passes health plus authenticated success/denial smoke against the isolated target;
- no production notification, external write, email, publication, or Content Agency/OS Electoral action can fire from the restore environment.

Two humans (Restore owner and Database owner) review and sign the result. A successful command without application and isolation verification is not a successful restore.

### 5. Decide promotion or disposal

For disaster recovery, the Incident Commander and owners decide whether to promote the recovered environment after reconciliation and security review. For a drill, record timings and gaps, then securely dispose of the isolated data/environment according to the approved retention process. Rotate any credential exposed outside its normal boundary.

## Drill record template

Every drill or real restore records:

- incident/change ID, date, scope, owners, and approvers;
- chosen recovery point and why;
- backup/object versions, release image digest, migrations, and tool versions;
- start, usable-database, application-ready, and completion times;
- measured data loss compared with source checkpoint;
- checksum, schema, RLS, counts, object hashes, and smoke outcomes;
- deviations, security/privacy exposures, manual steps, and failed assumptions;
- measured RPO/RTO result against approved targets;
- follow-up owners and dates.

Current drill evidence: none. Do not mark this runbook “validated” until a production-like isolated restore has been completed and reviewed.

## Context7 primary-source evidence

On 2026-07-18 the following query was executed:

```text
npx ctx7 docs /websites/postgresql_current "pg_dump pg_restore backup restore verification current"
```

Context7 resolved PostgreSQL's current primary documentation at `postgresql.org/docs/current`, including custom-format `pg_dump`, `pg_restore`, and archive listing/restore behavior. It also returned `pg_verifybackup`, which applies to physical base backups rather than the logical custom dump defined here. This evidence informed command selection; it is not proof that a backup, restore, point-in-time recovery, or drill has run.

## Escalation

Checksum failure, missing object versions, inability to obtain the approved recovery point, cross-tenant access, corrupted evidence links, lost encryption keys, unexpected data exposure, or RPO/RTO breach is an incident. Follow [Incident response](./incident-response.md); do not improvise a destructive restore over production.
