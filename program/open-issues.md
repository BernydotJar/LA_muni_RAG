# Open Program Issues

Updated: 2026-07-21

## Publication status

`feature/workflow-lifecycle-v1` contains functional commit `c6e110c` and is published at exact policy/evidence checkpoint `f12ee17`. `main` remains `4950ba3`; no merge or deployment is claimed. Git pull refs did not expose a matching PR ref, so PR and remote CI state remain unverified rather than assumed. The connector reported an error despite the successful remote mutation; remote refs must be checked before retrying.

## Ready product work

### WS04-CONFLICT-RESOLUTION-001

Persist conflict/version applicability decisions, retain both documentary positions, require human resolution, and prevent silent promotion into approved procedures or ClaimPacks.

### WS08-PROCEDURE-ASSESSMENT-001

Implement versioned `ProcedureAssessment` and dedicated evidence-gap request/provider contracts with authentication, RBAC, tenancy, idempotency, audit, and consumer tests.

### WS06-CASE-LIFECYCLE-001

Replace browser-local procedure tracking with a tenant-scoped server-side system of record for cases, steps, documents, blockers, follow-up, dossier, and immutable audit.

### WS09-WORKFLOW-UI-001

Implement authenticated, role-aware workflow review/approval UI, source inspection, error/empty/loading states, and WCAG 2.2 AA evidence.

### WS02-CORPUS-ACQUISITION-001

Acquire and validate the minimum Antigua and Mixco corpus, preserve hashes/provenance/authority, run real artifact acceptance, ingest, retrieve, and evaluate without claiming missing sources.

### WS10-PLATFORM-001

Select and document the production platform; implement Terraform, secrets boundaries, logs/metrics/traces, rate-limit topology, backup/restore, rollback, incident response, load/HA, and staging evidence.

## Human gates

- protected merge;
- production deployment;
- external publication;
- production credentials or billing changes;
- conclusions about legal applicability of an approved workflow.
