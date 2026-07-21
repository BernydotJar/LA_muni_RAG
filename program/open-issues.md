# Open Program Issues

Updated: 2026-07-21T23:20:48Z

## Publication and integration

`feature/catalog-api-v1` is published at exact functional SHA
`9da29720c23d64bc73bdb24e92e67707834f4f84`. Backend CI run
`29876782983` is in progress at this checkpoint. `origin/main` remains
`4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`; no PR, merge, deployment or
production observation is claimed.

## Remaining minimum API

### WS05-SEARCH-EVIDENCE-API-001 — ready

Implement:

```text
POST /api/v1/search
POST /api/v1/evidence-bundles
```

Required controls: authentication before body, tenant/RBAC binding, closed
schemas, bounded filters/results, authority/jurisdiction/confidentiality state,
citation provenance, idempotency/replay for bundles, rate/audit controls,
non-owner PostgreSQL gates, adversarial HTTP tests and compiled smoke.

Search must not claim quality merely because results are returned. The dedicated
EvidenceBundle route must preserve the existing identity-bound evidence semantics
and cannot promote inference, validation-required or comparative evidence.

## Corpus and evidence blockers

- 17 inventory records, 4 verified, 1 with acquisition metadata, 0 ingested;
- the acquired ignored artifact bytes are absent from this checkout;
- no authorized durable object store or production scanner operation;
- no real-corpus extraction, embeddings, retrieval thresholds or human citation review;
- no human-approved official water procedure for Antigua;
- comparative Mixco/MuniGuate material still requires Antigua or national corroboration.

## Human identity and privacy blockers

- no approved human IdP/OIDC/PKCE/BFF/session architecture;
- no provisioning, revocation, recovery or periodic access review;
- no approved purpose, retention, deletion/legal-hold or DSAR process for case and
  EvidenceGap text;
- no authenticated browser role shell.

## Platform and operations blockers

- no production Terraform/environment, object store, scanner, dispatcher, secrets
  or workload identity;
- no production logs/metrics/traces, SLOs or exercised alerts;
- no staging, load/capacity or HA evidence;
- no coordinated object/database restore, PITR, KMS/key recovery or approved RPO/RTO;
- no cross-repository consumer contract evidence.

## Human/tool gates

- protected merge and production deployment;
- paid/external infrastructure;
- sensitive production credentials;
- legal applicability, privacy and release approvals;
- human WCAG/browser/screen-reader sign-off.
