# Production controls and release decision

Status: pending human decision
Packet ID: `HDP-PRODUCTION-001`

## Decision required

Approve, reject or defer a bounded production-readiness program and eventual release authority. The decision must identify required controls, evidence owners, release approvers, stop conditions and which prerequisites must be satisfied before a later production go-live receipt can exist.

No action is authorized by this packet alone.

## Current evidence

- Protected merge: absent.
- Production release/public enablement: absent.
- Production gateway/edge, managed load, HA, failover, restore, regional recovery and privacy operations: absent.
- Productive IdP and real corpus: absent.
- Productive authenticated browser journeys: `0/12`.
- Productive telemetry exporter, SLO/error budget, alerting and on-call ownership: absent.
- Managed GCP staging receipt: absent.
- Local Features 077–079 provide provider-neutral identity/session, a role-aware shell and bounded local reliability evidence only.
- Audited branch publication is currently blocked, so PR #24 and exact-SHA remote CI do not contain the local increments.

## Options

### Option A — Approve a production-readiness evidence program only

Authorize named owners to collect evidence in managed staging against a defined gate checklist. This option does not authorize production traffic, public enablement, protected merge or a production readiness claim.

### Option B — Approve a bounded production pilot after all prerequisite receipts

Define user/tenant scope, traffic/data limits, rollback authority, support hours, incident thresholds and expiration. A separate final go-live receipt remains required after staging evidence is reviewed.

### Option C — Defer production work

Continue local/ephemeral engineering, decision preparation and non-production evidence. Preserve all production gates as open.

### Option D — Reject production release for the current program phase

Document archive/maintenance expectations, data/resource disposition and future reconsideration criteria.

## Evaluation criteria

- approved productive IdP, user lifecycle, MFA/recovery and access review;
- rights-cleared representative corpus and independently adjudicated retrieval/citation/freshness evidence;
- authenticated role-aware workflows and all twelve productive browser journeys;
- gateway/edge/TLS, rate limiting, request bounds, security headers and abuse response;
- managed database/network/IAM/secrets, migrations, backups, restore and failover;
- representative load/capacity, SLO/SLI/error budget, telemetry, dashboards, alerts and on-call;
- failure injection, dependency outage, process restart, rollback and regional recovery;
- privacy notices, retention/deletion, data-subject/public-records handling and incident response;
- accessibility across supported browsers, keyboard, zoom, screen reader and human review;
- external consumer contract/interoperability and portable provider-side kits;
- supply-chain, dependency, vulnerability, secret and artifact integrity controls;
- protected branch, approvals, exact-SHA CI, signed release evidence and change management;
- cost/billing, support staffing and ownership.

## Preconditions

- approved receipts for `HDP-IDP-001`, `HDP-CORPUS-001` and applicable `HDP-CLOUDSQL-001` actions;
- branch publication and exact-SHA CI evidence;
- complete release candidate inventory and immutable artifact/SBOM references;
- managed staging deployment with production-like topology and data controls;
- security, privacy/legal, operations, accessibility and product acceptance;
- production runbooks for deploy, rollback, incident, access review, backup/restore and provider outage;
- quantified SLO/error budget and capacity evidence in representative conditions;
- release authority, change window, stop conditions and communication plan.

## Prohibited until approval

- protected merge or branch-policy mutation;
- production deploy, public enablement or Pages replacement;
- productive traffic, users, credentials, corpus or billing changes;
- production SLO commitment or readiness declaration;
- disabling security/privacy/accessibility gates to meet a date;
- relying on deterministic adapters, local load or synthetic corpus as productive evidence;
- force push, history rewrite or destructive migration;
- representing provider-side contracts as implementation of OS Electoral or Content Agency.

## Acceptance evidence after approval

- prerequisite decision receipts and closure evidence;
- exact release SHA, remote-parent verification and exact-SHA CI;
- managed staging deployment/teardown receipts;
- productive IdP and authenticated journey evidence;
- real-corpus rights and retrieval/citation/freshness evaluation;
- representative load, SLO/error budget and capacity results;
- telemetry/dashboard/alert/on-call and incident-drill evidence;
- backup restore, failover, rollback and regional recovery evidence;
- privacy, security, accessibility, external consumer and operations sign-off;
- final release authority receipt with bounded scope and rollback trigger.

## Decision receipt

Create a separate receipt conforming to `contracts/decision-packets/v1/human-decision-receipt.schema.json` with:

- `packet_id: HDP-PRODUCTION-001`;
- approved/rejected/deferred outcome;
- authority roles and durable decision record reference;
- whether approval covers evidence collection, pilot preparation or final release;
- exact environment, users/tenants, traffic/data bounds and time window;
- explicitly approved merge/deploy/publication actions;
- stop conditions, rollback authority and incident thresholds;
- prerequisite evidence references and unresolved exceptions;
- expiration/review date and post-release evidence requirements.
