# Cloud SQL lifecycle decision

Status: pending human decision
Packet ID: `HDP-CLOUDSQL-001`

## Decision required

Approve, reject or defer a bounded Cloud SQL lifecycle action and data/cost operating model. The receipt must distinguish restart, configuration/apply, validation window, shutdown, backup retention, teardown and data disposition. Approval of one action never implies approval of another.

No action is authorized by this packet alone.

## Current evidence

- Managed Cloud SQL state: `STOPPED`.
- Activation policy: `NEVER`.
- Restart: not authorized.
- Terraform apply/destroy or other infrastructure mutation: not authorized.
- Billing changes: not authorized.
- Teardown and data/backup deletion: not authorized.
- Managed GCP staging receipt: absent.
- Local PostgreSQL 15.18/pgvector 0.8.5 migration and non-owner runtime gates pass, but they do not prove managed lifecycle, networking, IAM, backups, failover or cost behavior.

## Options

### Option A — Keep stopped

Preserve the current instance and data/backup state. Approve only non-mutating inventory, cost-estimate and decision analysis. Define the next review date and ownership.

### Option B — Approve a bounded restart and validation window

Authorize an exact instance, environment, start time/window, maximum duration, cost bound and validation plan. Require post-validation stop evidence. This option does not authorize Terraform mutation, HA changes, destructive migration, teardown or production use.

### Option C — Approve configuration/apply in managed staging

Authorize only enumerated Terraform or Cloud SQL changes with plan receipt, peer review, cost/security approval, backup/rollback and exact post-apply validation. Restart permission must be explicit.

### Option D — Approve teardown/data disposition

Authorize exact resources, backups, snapshots, retention/export requirements and irreversible deletion sequence. This option requires separate data-owner, operations, security and billing authority and is never implied by cost pressure.

### Option E — Defer lifecycle changes

Keep `STOPPED`/`NEVER`, preserve evidence and continue local or ephemeral work that does not require the managed instance.

## Evaluation criteria

- exact project, region, instance and environment ownership;
- current resource inventory, drift and Terraform plan state;
- data classification and whether any retained state is synthetic or real;
- private/public connectivity, IAM, service accounts, secrets and certificate path;
- database roles, RLS, migration authority and non-owner runtime model;
- backup, point-in-time recovery, retention, encryption and restore testing;
- HA/failover, maintenance, patching and version lifecycle;
- start/stop behavior, activation policy and prevention of accidental wake-up;
- cost estimate, budget/alert owner and maximum authorized spend;
- shutdown, rollback, teardown and evidence-retention sequence.

## Preconditions

- exact non-secret resource inventory and current state receipt;
- reviewed Terraform plan or explicit statement that no Terraform mutation is included;
- named cloud operations, security, billing and data owners;
- bounded action list, environment, time window and spend ceiling;
- backup/restore and rollback plan appropriate to the action;
- secrets/IAM/networking review with no credentials committed to the repository;
- validation plan for migrations, non-owner roles, connectivity, telemetry and shutdown;
- post-action receipt requirements including state, activation policy, cost and data disposition.

## Prohibited until approval

- restarting the instance;
- changing activation policy;
- running Terraform apply or destroy;
- changing IAM, networking, secrets, backups, HA or maintenance configuration;
- changing billing/budgets or incurring unbounded spend;
- running destructive migration or deleting data/backups;
- using the instance as production or claiming managed-staging readiness;
- treating local PostgreSQL evidence as managed lifecycle evidence.

## Acceptance evidence after approval

- exact decision receipt and pre-action resource/state inventory;
- reviewed plan/diff and authorized-action checklist;
- start/apply/destroy command receipt without secrets;
- connectivity/IAM/non-owner database validation;
- migration and application smoke on the exact managed instance if authorized;
- backup/restore or rollback evidence appropriate to the action;
- cost and budget receipt;
- final instance state, activation policy and data/backup disposition receipt;
- evidence that no unauthorized adjacent resource was changed.

## Decision receipt

Create a separate receipt conforming to `contracts/decision-packets/v1/human-decision-receipt.schema.json` with:

- `packet_id: HDP-CLOUDSQL-001`;
- approved/rejected/deferred outcome;
- authority roles and durable decision record reference;
- exact project/region/instance and environment;
- separately enumerated restart, apply, destroy, backup, restore and deletion actions;
- time window, spend ceiling and automatic stop condition;
- data/backup retention and rollback constraints;
- evidence required before and after execution.
