# Open Program Issues

Updated: 2026-07-21T19:36:34Z

## Publication and CI

`feature/evidence-gap-request-v1` is published at exact functional SHA
`66b41b943242d9c4317d35f125de1cd617ebb6e4`. `origin/main` remains
`4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`; no merge or deployment is
claimed. GitHub reports no PR. Backend CI run `29861888791` and check
`88740409681` completed successfully on the exact functional SHA.

## EvidenceGap remaining work

The provider records an immutable `open`, `requester_supplied_unverified`
intake and safely handles replay, aggregate identity, tenant isolation and audit.
It does not provide:

- research assignment or queue ownership;
- append-only status/resolution events;
- source acquisition/validation or notifications;
- an OS Electoral consumer contract test;
- approved purpose, retention, deletion, legal hold or privacy notice;
- staging, load, observability, backup/restore or deployment evidence.

## Ready product work

### WS09-PROCEDURE-TRAINING-001

Create a high-density, accessible training preview that teaches a municipal
procedure step-by-step, keeps evidence and missing information visible, supports
keyboard/reduced-motion use, and never pretends that public/demo state is an
authenticated SaaS session or institutional certification.

### WS06-CASE-LIFECYCLE-001

Server system of record for approved procedure version, steps, documents,
blockers, follow-up, dossier and append-only audit.

### WS09-AUTH-SHELL-001

Choose the human-browser authentication/session architecture and tenant
provisioning model. Integration Bearer credentials must not be stored in browser
JavaScript or LocalStorage.

### WS04-RETRIEVAL-EVAL-001

Authorize tenant vector retrieval, complete filters/reranking, and measure recall,
citation fidelity, groundedness and load on real corpus.

### WS02-CORPUS-ACQUISITION-001

Acquire, hash, classify, scan, ingest and retrieve the minimum Antigua-first plus
Mixco/Guatemala comparative corpus without inventing missing documents.

### WS10-PLATFORM-001

Terraform, secrets, observability/SLOs, backup/restore, rollback, load/HA,
staging and incident exercise.

## Missing dedicated evals

`EVAL-SOURCE-001`, `EVAL-MISSING-001`, `EVAL-RBAC-001`, `EVAL-INGEST-001`,
`EVAL-CASE-001`, `EVAL-ACCESSIBILITY-001`, and `EVAL-RESTORE-001`.

## Human/tool gates

- protected merge and production deployment;
- external infrastructure/spending/credentials;
- human browser identity-provider and session decisions;
- EvidenceGap retention/legal-hold/privacy approval;
- legal applicability conclusions.
