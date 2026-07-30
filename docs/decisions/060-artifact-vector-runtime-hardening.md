# Decision 060 — Exact artifact acceptance and privileged row-lock boundary

Status: accepted for the feature branch; remote CI and protected merge pending.

## Context

Migration 007 persisted immutable object coordinates and scan records, but the
database allowed an object to be marked `accepted` while its linked `clean`
scan proved different bytes or an arbitrarily long acceptance window. The
application repeated only verdict and expiry checks. Completion attempted
`FOR SHARE` directly as the worker role; PostgreSQL correctly required a table
mutation privilege that the worker must not receive.

## Decision

1. Migration 011 stops over invalid historical accepted rows.
2. A `BEFORE INSERT OR UPDATE` trigger validates current generation, clean
   verdict, exact SHA-256, declared/detected MIME, future expiry, and a maximum
   seven-day scan window.
3. Accepted object identity is immutable until the object transitions out of
   `accepted` and a new inspection generation starts.
4. Scan updates are forbidden; subsequent evidence is a new append-only row.
5. Accepted lookup and lease acquisition repeat the same predicates.
6. Finalization calls
   `rag.lock_valid_artifact_acceptance_v1(uuid,uuid,uuid,text,uuid)`, a
   fixed-search-path tenant-bound `SECURITY DEFINER` function that returns only a
   boolean and holds row locks until transaction end.
7. `PUBLIC` has no function execution; the worker receives only narrow
   `EXECUTE` plus read privileges, not artifact-table `UPDATE`.

## Alternatives rejected

- Granting worker `UPDATE` solely to satisfy `FOR SHARE`: violates least
  privilege and permits acceptance mutation.
- Application-only validation: cannot defend against alternate writers or
  migration drift.
- Copying object coordinates or scan payloads into jobs: creates stale identity
  and credential/URL leakage risk.
- Silently repairing historical mismatches: invents which bytes were scanned.

## Consequences

Corrupt historical acceptance stops deployment for review. Completion remains
atomic and may wait behind a legitimate acceptance supersession. Production
role provisioning must grant the narrow function explicitly. Real storage,
scanner, queue, monitoring, and capacity evidence remain separate gates.
