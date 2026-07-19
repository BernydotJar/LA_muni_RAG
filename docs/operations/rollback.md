# Rollback runbook

Status: pre-production procedure; no production rollback rehearsal has been completed
Last reviewed: 2026-07-18
Owner: Release/Platform owner pending assignment
Required authority: Incident Commander or Release manager plus Database owner when data/schema is involved

## Core rule

Rollback means returning application traffic to a previously verified immutable image while preserving data and audit evidence. It does not mean reversing an applied migration destructively, editing production rows by hand, force-pushing history, or restoring an old database over a live one.

Applied database migrations are forward-only. When a schema or data migration is faulty, prefer traffic isolation, the previous compatible application image, and a reviewed corrective forward migration. Database restore is a disaster-recovery operation under [Backup and restore](./backup-restore.md), not a routine release rollback.

No production platform, feature-flag service, immutable registry, N/N-1 compatibility proof, or rollback drill is currently evidenced. These are blockers, not assumed capabilities.

## Rollback triggers

The monitoring owner or release team pauses promotion and calls the Incident Commander/Release manager for any of:

- authentication, authorization, RLS, or cross-tenant isolation failure;
- secret, query/case content, document, or personal-data disclosure;
- invalid source/version/citation, corrupt procedure output, or draft represented as approved;
- material error/timeout/latency/restart or database saturation above an approved threshold;
- unsafe logging, missing audit delivery, uncontrolled retries, idempotency corruption, or rate-limit failure;
- migration error, lock impact, integrity violation, or incompatible schema behavior;
- contract break for an approved consumer;
- failed health/smoke test or unavailable dependency without safe degradation;
- inability to observe the release sufficiently to decide it is safe.

Security, privacy, integrity, or sustained availability triggers also open an incident. Approved numeric thresholds remain pending SLO/capacity decisions; absence of a threshold is not permission to continue an unsafe rollout.

## Rollback decision matrix

| Condition | First containment | Recovery path |
|---|---|---|
| Application defect; schema compatible with prior image | stop promotion, drain new revision | route to prior image digest |
| New route/feature unsafe and independently disableable | block route/traffic at approved ingress or configuration | disable, verify, then decide image rollback |
| Forward migration failed before commit | stop release, preserve migration output | keep prior image; investigate and submit corrected migration |
| Migration committed; prior image remains schema-compatible | stop writes/promotion where necessary | route to prior image, then corrective forward migration |
| Migration committed; prior image incompatible | isolate affected operations | deploy reviewed compatibility fix; do not run destructive down migration |
| Suspected data corruption or cross-tenant write | freeze affected writes and credentials, preserve evidence | incident-led reconciliation/corrective migration; restore only through DR decision |
| Credential compromise | revoke/rotate and block affected identity | redeploy/restart with new secret reference after scope analysis |
| External provider/adapter failure | stop outbound calls/retries | safe refusal/degradation; rollback only if release caused unsafe behavior |
| Public Pages regression | stop/revert static artifact through its separate workflow | does not change backend image or database |

## Prerequisites for a releasable version

Every production change record must contain:

- current and prior commit SHA and immutable registry digest;
- database schema/migration compatibility matrix for application N and N-1;
- contract compatibility and consumer inventory;
- backup checkpoint and restore owner;
- exact smoke probes and monitoring owner;
- rollout and rollback approvers;
- incident channel and communications owner;
- evidence that the prior image is still available and not affected by the same vulnerability.

If the prior image cannot safely use the post-migration schema, there is no valid image rollback. The release must not proceed until expand/migrate/contract sequencing or another reviewed recovery path makes it safe.

## Procedure

### 1. Declare and contain

1. State “rollback under evaluation” in the approved incident/change channel.
2. Name the decision owner and scribe; record time, release/image/migration IDs, symptoms, affected tenant/data class, and trigger.
3. Stop traffic promotion and nonessential writes/jobs. Do not delete the failing revision or logs.
4. For a security/privacy event, rotate or disable compromised identities and follow [Incident response](./incident-response.md).
5. Preserve request/correlation IDs, sanitized logs, dashboards, deployment events, migration output, and audit references.

### 2. Verify the rollback target

Confirm the prior image by digest, its scan/risk status, schema compatibility, secret/config compatibility, contract compatibility, and known vulnerabilities. Confirm the database migration state and backup checkpoint. Never guess which tag was “previous.”

### 3. Shift application traffic

Use the selected platform's audited traffic mechanism to create/retain the prior digest revision, inject current approved secret references, and send a canary fraction before full rollback when the incident allows. The repository intentionally provides no cloud-specific command before a platform is selected and approved.

Do not:

- rebuild the prior commit and assume identical bytes;
- use `latest` or another mutable tag;
- run down-SQL or edit an applied migration;
- use a database restore to undo ordinary application writes;
- drop tables, policies, columns, tenants, audit, or idempotency records;
- disable RLS/authentication to make the prior image work;
- destroy the failing revision before evidence is secured.

### 4. Verify recovery

Run the same release smoke checks against the rollback target:

- health and dependency status;
- authenticated success and schema conformance;
- uniform 401, forbidden-role and cross-tenant 403 with sanitized denial audit;
- idempotency replay/conflict and rate limit;
- source/version/citation integrity;
- boundary refusal;
- database errors, locks, pool health, latency, restarts, resource saturation, and audit delivery.

Confirm that new unsafe writes have stopped and that no tenant received another tenant's data. If integrity is uncertain, keep affected writes disabled and continue incident recovery rather than declaring rollback complete.

### 5. Reconcile and close

Record final traffic/image state, database migration state, start/end time, impact window, smoke/monitoring evidence, data reconciliation need, approvals, communications, and follow-up owners. Create corrective forward migrations or application changes through normal review. Re-enable traffic/jobs only after the responsible owner signs off.

## Database correction principles

- Correct with a new immutable migration or audited repair job that is idempotent, scoped, reviewed, backed up, and tested on a production-like restore.
- Preserve before/after counts, safe identifiers, reason, operator, approval, and result without logging sensitive row bodies.
- Prefer quarantining or superseding suspect evidence over deleting provenance.
- Never rewrite a previously released migration file.
- If a destructive contract step is ever necessary, schedule it only after all application versions and consumers have moved off the old shape and a separate human approval confirms recovery evidence.

## Pages rollback boundary

GitHub Pages is a separate public static demo. A Pages rollback should select/revert a reviewed static commit and run its own artifact verification/deployment governance. It must not be described as a backend rollback and cannot recover API, PostgreSQL, tenant isolation, or confidential data.

## Rehearsal requirement

Before production, rehearse at least these scenarios in an isolated production-like environment:

1. application-only rollback with no migration;
2. expand migration followed by prior-image rollback;
3. incompatible migration discovered before traffic (release abort);
4. cross-tenant/security containment with credential rotation;
5. correction via a new forward migration;
6. Pages-only regression separated from backend.

Record measured recovery time, evidence, manual gaps, and owners. Current rehearsal evidence: none.
