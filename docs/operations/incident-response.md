# Incident response runbook

Status: pre-production procedure; contact roster, paging, channels, and exercise pending
Last reviewed: 2026-07-18
Program owner: Security/Operations owner pending assignment

## Operational truth

This runbook defines roles and actions but does not prove an on-call function exists. No named incident roster, 24/7 paging service, secure incident channel, legal notification owner, status page, forensics platform, or completed tabletop is evidenced. Production approval is blocked until humans fill those dependencies and exercise the process.

Do not put credentials, database URLs, full query/case bodies, document contents, personal data, internal campaign data, or unredacted dumps in chat, tickets, status updates, screenshots, or postmortems.

## What is an incident

Open an incident for suspected or confirmed harm to confidentiality, integrity, availability, privacy, tenant isolation, source/procedure provenance, build/release integrity, or external contract boundaries. When uncertain, contain and classify; do not delay because impact is not yet proven.

Examples include:

- cross-tenant read/write, broken RLS/RBAC, or resource enumeration;
- exposed token, database credential, backup, source body, query/case content, or personal data;
- public Pages artifact containing non-public data or a secret;
- forged/poisoned source, corrupted version/hash/citation, or draft shown as approved;
- prompt injection causing policy bypass or exfiltration;
- dependency/base-image/build-runner compromise;
- sustained outage, restart loop, database exhaustion, destructive retry, or denial-of-wallet;
- unauthorized ingestion or storage of internal campaign/electoral/content data;
- invalid external ClaimPack/contract behavior causing downstream harm;
- failed backup, unavailable recovery key, restore corruption, or breached RPO/RTO.

## Severity model

The Incident Commander assigns the highest plausible severity and may lower it only with evidence.

| Severity | Definition | Response expectation |
|---|---|---|
| SEV-1 Critical | confirmed/suspected cross-tenant or material sensitive-data exposure; active compromise; widespread integrity loss; destructive production event; full critical outage with no safe workaround | page all required roles immediately, contain before routine diagnosis, continuous command until stable |
| SEV-2 High | significant tenant/service impact, credential exposure with bounded scope, material evidence/procedure corruption, or critical dependency failure with unsafe degradation | urgent coordinated response and frequent approved updates |
| SEV-3 Medium | limited degradation or security weakness with low/contained impact and a safe workaround | owner assigned promptly, monitored mitigation and scheduled updates |
| SEV-4 Low | non-urgent defect or near miss with no current security/privacy/integrity impact | track through normal change process and consider learning review |

Exact paging and update-time objectives are pending the approved SLO/on-call model. That gap does not prevent immediate escalation of suspected SEV-1/SEV-2 events.

## Roles

One person may cover multiple roles only when severity and conflict-of-interest rules allow it.

| Role | Accountability |
|---|---|
| Incident Commander (IC) | severity, priorities, containment authority, cadence, handoffs, resolution decision |
| Operations lead | runtime, ingress, database, traffic, rollback/recovery actions |
| Security lead | compromise analysis, credential actions, evidence preservation, forensics |
| Privacy/Legal lead | personal-data assessment, legal/contract notification decisions, holds |
| Product/municipal liaison | user/tenant impact, procedural/evidence correctness, municipal coordination |
| Communications lead | approved internal, tenant, public, partner, and vendor updates |
| Scribe/evidence custodian | timeline, decisions, safe evidence index, action/owner tracking |
| External integration owner | OS Electoral/Content Agency containment and contract impact, without cross-product DB access |

The named primary/backup roster, secure phone/channel, paging group, municipal contacts, vendor contacts, registry/cloud/database escalation paths, and break-glass custodians are pending. Never commit personal contact data or live credentials to this repository.

## First response

### First 15 minutes (target to be approved)

1. Acknowledge and open an incident in the approved restricted system; assign temporary severity.
2. Name IC and scribe. Record UTC start, reporter, safe symptom, affected service/release/tenant class, and initial request/correlation IDs.
3. Protect people/data first: stop public traffic, affected route, integration, ingestion, job, or writes when credible harm could continue.
4. Revoke/rotate suspected credentials through the secret manager and identity system; do not paste them into the incident record.
5. Preserve logs, audit references, deployment events, image digest, commit/migration IDs, database/service events, and object versions before routine retention overwrites them.
6. Notify Security and Privacy/Legal for any possible confidentiality, tenant, personal-data, backup, or campaign-boundary event.
7. Establish an update cadence and a facts/unknowns/decisions/actions board.

If tooling/contacts are not yet available, escalate to the Product owner and pause exposure rather than improvising with public chat or personal storage.

## Containment playbooks

### Cross-tenant or authorization failure

- Stop affected routes and writes; do not merely hide the UI.
- Disable the implicated principal/credential and preserve its safe ID/digest reference.
- Record affected tenant/time/resource classes without querying or exporting excess content.
- Verify application authorization and PostgreSQL RLS independently.
- Treat uniform empty/denied responses carefully; absence in an application log does not prove no database access.
- Do not restore service until negative isolation tests and audit delivery pass on the exact fix.

### Credential or secret exposure

- Revoke/rotate first, including derived sessions and dependent credentials.
- Search approved secret/audit systems for use by safe identifiers/time ranges; do not copy secret values.
- Remove exposed artifacts through the platform's secure process while preserving restricted forensic evidence.
- Rebuild/redeploy only if the secret entered an image layer or build artifact; confirm history/cache/registry scope.

### Source, evidence, or prompt poisoning

- Quarantine the source/version from retrieval without deleting its provenance.
- Stop dependent workflow/ClaimPack generation and notify approved consumers using safe artifact IDs.
- Preserve bytes/hash/acquisition/authority/ingestion metadata in restricted evidence storage.
- Review outputs/citations generated during the impact window; supersede or revoke affected artifacts explicitly.

### Availability or denial-of-wallet

- Apply approved ingress/rate/queue limits, pause expensive hybrid/embedding work, and protect database capacity.
- Prefer safe refusal to unbounded retries or global data fallback.
- Keep enough telemetry to distinguish abuse, release regression, dependency failure, and capacity exhaustion.

### Public Pages exposure

- Disable/revert the static artifact through GitHub Pages controls; do not assume backend rollback fixes it.
- Rotate any exposed credential even if the client should not have been able to use it.
- Determine cache/search-index/fork exposure with Security/Privacy; preserve the artifact hash and commit.

### Cross-product boundary violation

- Stop the adapter/message flow and quarantine envelope/artifact references.
- Notify the owning product through approved contacts; do not access its database or copy its internal payload into LA Muni RAG tooling.
- Revoke/supersede affected LA Muni outputs and preserve contract/message IDs, versions, hashes, and outcomes.

## Investigation and evidence

The scribe maintains an append-only UTC timeline of observations, hypotheses (labeled), decisions, commands/actions, actors, approvals, and outcomes. Evidence receives an ID, acquisition time, source system, collector, hash where applicable, classification, access list, retention/legal-hold status, and chain-of-custody entries.

Collect the minimum needed from:

- deployment/revision/image digest and build provenance;
- application safe logs/metrics/traces and request/correlation IDs;
- identity, authorization, rate-limit, and sanitized audit events;
- database service events, query/lock/pool metrics, migration ledger/output, and RLS/role configuration;
- secret-manager access/rotation events;
- object/source versions, hashes, inventory, and ingestion events;
- contract message/artifact IDs and consumer receipts;
- Pages artifact hash/workflow events when relevant.

Do not run broad production dumps or copy raw rows into the incident system. Forensics access is read-only where possible and approved by Security/Privacy. Record every break-glass action and rotate its credentials after use.

## Communications

Only the Communications lead sends external updates after IC and Privacy/Legal approval. Use confirmed facts; distinguish scope, impact, containment, and unknowns. Do not identify another tenant, reveal defensive detail that aids abuse, speculate about cause, promise a recovery time without evidence, or state that data was not accessed solely because logs are absent.

Minimum internal update:

```text
Incident: INCIDENT_ID | Severity: SEV-X | UTC: TIME
Confirmed: SAFE_FACTS
Potential impact: TENANT_OR_DATA_CLASS, not sensitive content
Contained: YES/NO/PARTIAL and how at a high level
Unknowns: KEY_UNKNOWNS
Next actions/owners: ACTIONS
Next update: APPROVED_TIME_OR_TRIGGER
```

Tenant, municipal authority, regulator, insurer, vendor, and partner notification obligations/timelines are decided by the named Privacy/Legal and contract owners for the facts and jurisdictions involved. This repository does not prescribe or claim a statutory deadline.

## Recovery and validation

Recovery follows reviewed [Deployment](./deployment.md), [Rollback](./rollback.md), or [Backup and restore](./backup-restore.md) procedures. Before restoring traffic:

- root containment remains effective and compromised credentials are revoked;
- the exact image/config/migration is identified and approved;
- health plus authenticated, forbidden-role, cross-tenant, idempotency, rate-limit, boundary, and evidence-integrity smoke pass;
- RLS and least-privilege database roles are independently verified;
- logs/audit are delivered and safely redacted;
- affected artifacts/sources are quarantined, superseded, or reconciled;
- monitoring and a heightened observation owner/cadence are active;
- IC, Security, Database, Product, and Privacy/Legal approve as applicable.

## Resolution and postmortem

IC declares resolution only after impact has stopped, recovery is stable, evidence is preserved, communications are current, and every reconciliation/notification obligation has an owner. “Service is up” alone is not resolution for data, tenant, or integrity incidents.

The postmortem should be blameless and cover:

- executive summary and user/tenant/data impact;
- detection source and why controls did or did not detect earlier;
- UTC timeline and decision points;
- technical and organizational contributing factors;
- containment/recovery effectiveness and measured durations;
- data/provenance/contract reconciliation and notification decisions;
- what went well, what was difficult, and unsafe luck;
- corrective actions with priority, owner, due date, verification method, and linked threat/control;
- recurrence test and closure evidence.

The organization must approve a completion target and review forum before production; no timeline is asserted here. High-severity actions cannot be closed solely by editing documentation.

## Readiness exercises

Before production, run and record tabletop/technical exercises for cross-tenant access, exposed credential, poisoned official source, database outage/restore, container rollback, public Pages leak, and cross-product boundary violation. Include role handoff and communications. Current exercise evidence: none.
