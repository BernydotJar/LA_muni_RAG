# LA Muni RAG — Open Issues

Updated: 2026-07-22T00:35:00Z

## Closed locally by Feature 068

- `POST /api/v1/search` is implemented with explicit keyword, phrase, semantic and hybrid modes.
- `POST /api/v1/evidence-bundles` is implemented with conservative claim promotion, exact replay and corrupt-replay cleanup.
- Closed contracts, OpenAPI 3.1.1, named evals, forced-RLS PostgreSQL gates and compiled HTTP smoke pass on functional commit `42d2fda70b27ccc9178c6a8d69bba957ef953105`.
- The branch is published at the exact SHA; Backend CI run `29880372748` completed successfully on the exact functional SHA. No PR, merge or deployment exists.

## Critical product blockers

### Corpus and retrieval quality

1. No authorized durable source bytes are present; zero documents are credited as ingested against a real reviewed corpus.
2. Antigua-first and national source acquisition, current scanning, extraction, chunking and embeddings remain unexecuted.
3. Keyword, phrase, semantic and hybrid relevance, citation quality, latency and load remain unmeasured on real corpus data.
4. Human review of authority, vigencia, supersession, jurisdiction, applicability and contradictions remains mandatory.

### Human SaaS

1. Human IdP/OIDC, authorization-code-with-PKCE, session/BFF, provisioning, logout, revocation and recovery are undecided/unimplemented.
2. Secure cookies, CSRF, role-aware navigation and authenticated source/library/search/case/review/admin/audit surfaces remain absent.
3. Supported-browser, screen-reader and human WCAG 2.2 AA evidence remains absent.

### Production platform and operations

1. Terraform/environments, workload identity, secrets, production object store/scanner/dispatcher and dead-letter UI are absent.
2. Metrics, traces, logs, SLOs, alerts, staging, performance, capacity and HA have not been exercised.
3. Coordinated object/database recovery, PITR, KMS/key recovery and approved RPO/RTO remain open.
4. Privacy purpose, retention, deletion, legal hold and DSAR operations remain open.

### Integration and release

1. OS Electoral and Content Agency consumer contract suites remain external and unexecuted.
2. No reviewed PR, protected merge, staging deployment, production deployment or observation window exists.
3. Legal, privacy, security and release approvals remain human-gated.

## Next ready task

`WS02-CORPUS-ACQUISITION-001` — acquire an authorized Antigua-first corpus into approved durable storage, execute current scanning/extraction/ingestion, and preserve immutable manifests. This task is blocked in practice until storage, scanner, rights and retention decisions are available; no synthetic fixture may be credited as real corpus completion.
