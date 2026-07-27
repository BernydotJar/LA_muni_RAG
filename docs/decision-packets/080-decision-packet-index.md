# Feature 080 — Human-gated decision packet index

Status: pending human decisions
Last reviewed: 2026-07-27

## Purpose

This bundle converts unresolved production prerequisites into explicit, reviewable decisions. It does not select a provider, authorize corpus acquisition, mutate Cloud SQL/Terraform/billing, approve a protected merge, enable production, or claim production readiness.

The machine-readable source is `contracts/decision-packets/v1/human-gated-decision-packets.json`. Any approval must be captured in a separate receipt conforming to `contracts/decision-packets/v1/human-decision-receipt.schema.json` and linked from the relevant packet, program evidence register, task ledger and release plan before an authorized operator executes the bounded action.

## Packets

| Packet | Decision | Current status |
|---|---|---|
| `HDP-IDP-001` | Productive human identity provider and operating model | pending human decision |
| `HDP-CORPUS-001` | Real municipal corpus rights, scope and governance | pending human decision |
| `HDP-CLOUDSQL-001` | Cloud SQL lifecycle, cost and data disposition | pending human decision |
| `HDP-PRODUCTION-001` | Production controls, release authority and readiness gates | pending human decision |

## Current facts that cannot be overridden by implication

- real documents ingested: `0`;
- real-corpus retrieval evaluation: `0`;
- productive authenticated browser journeys: `0/12`;
- managed GCP staging receipt: absent;
- Cloud SQL: `STOPPED`, activation policy `NEVER`;
- productive IdP: not selected or configured;
- productive telemetry exporter/SLO: absent;
- protected merge and production release: absent;
- audited branch publication for local Features 077–079: blocked by disabled `git_push` capability.

## Receipt rule

A meeting note, chat message, inferred preference, test adapter, local benchmark, draft PR, or successful CI run is not an approval receipt. A receipt must name the packet, decision outcome, authority roles, bounded environment/scope, explicitly approved actions, constraints, evidence references, and reversal/expiry where applicable.

No action is authorized by this index alone.
