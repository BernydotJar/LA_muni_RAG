# 060 — Artifact, Lease, and Vector Runtime Hardening

Status: implemented and verified locally; remote CI pending

## Objective

Close the database-level gap that permits an artifact object to be marked
`accepted` without proving that the referenced scan is the current clean scan
for the exact expected bytes. Reiterate the same invariant when a worker leases
the job, resolves private bytes, and atomically publishes vectors.

## In scope

- fail a migration when an existing accepted object points to an invalid scan;
- validate accepted state with a PostgreSQL trigger;
- require the same tenant/object, current inspection generation, `clean`
  verdict, exact SHA-256, and a bounded future acceptance window;
- repeat those predicates in accepted-binding lookup, lease acquisition, and
  final vector publication;
- add deterministic regression tests and a disposable PostgreSQL gate;
- add named `EVAL-ARTIFACT-001`, `EVAL-VECTOR-001`, and
  `EVAL-JOB-LEASE-001` commands without weakening the existing real-database
  smoke gate.

## Out of scope

- production object storage or scanner deployment;
- reading or ingesting the controlled DMP artifact;
- changing the embedding provider or vector dimension;
- legal-validity decisions, campaign operations, or content production;
- protected merge or production deployment.

## Acceptance criteria

1. An accepted object cannot reference an infected, stale-generation, or
   wrong-hash scan.
2. `accepted_until` is later than both scan time and current database time, and
   no more than seven days after the scan.
3. Existing invalid accepted rows stop migration for explicit review.
4. Lease, binding resolution, and completion repeat the exact scan/hash/
   generation/window predicates.
5. Current valid ingestion fixtures continue to pass as a non-owner,
   `NOBYPASSRLS` role.
6. Named evals and the global regression pass with no skipped focused case.
7. Documentation preserves the distinction between implemented controls and
   absent production scanner/storage/worker operation.

## Rollback

The migration is additive. Rollback removes the trigger and validation
function only after confirming no caller relies on the stronger invariant. It
does not rewrite artifact, scan, job, or vector rows.


## Implementation plan and completed tasks

- [x] reproduce wrong-hash accepted state on PostgreSQL;
- [x] write failing migration/runtime regression;
- [x] stop migration over invalid historical accepted rows;
- [x] add exact clean-scan trigger and accepted-identity immutability;
- [x] make scan updates fail as append-only evidence;
- [x] add tenant-bound security-definer validation/row-lock boundary;
- [x] repeat exact predicates in accepted lookup and lease acquisition;
- [x] verify clean and supported legacy migration paths;
- [x] run non-owner SQL gates and compiled ingestion/API smokes;
- [x] add EVAL-ARTIFACT-001, EVAL-VECTOR-001, and EVAL-JOB-LEASE-001;
- [x] run cross-workstream regression and documentation checks;
- [ ] run remote Backend CI on the published feature commit;
- [ ] obtain human review before protected merge or deployment.

## Security considerations

The security-definer function returns one boolean, has a fixed search path,
compares its tenant parameter to the transaction-local authenticated tenant,
accepts only typed IDs and lowercase SHA-256, and is revoked from `PUBLIC`.
The worker receives `EXECUTE` on that function and `SELECT`, never `UPDATE`, on
artifact evidence tables. Raw object coordinates are not returned by the API.

## Test and eval plan

Deterministic tests cover service behavior, SQL shape, privilege wiring, vector
scope, bounds, and worker fencing. Required acceptance additionally runs fresh
and legacy PostgreSQL/pgvector migrations, non-owner RLS gates, concurrency,
rollback, replacement, and compiled HTTP smokes. Focused green tests do not
prove real scanner quality, object-store IAM, corpus retrieval quality, load,
HA, backup/restore, or production readiness.
