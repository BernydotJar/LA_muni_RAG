# LA Muni RAG — Release Plan

Updated: 2026-07-22T00:35:00Z

## Current release state

```text
functional_branch: feature/search-evidence-api-v1
functional_sha: 42d2fda70b27ccc9178c6a8d69bba957ef953105
remote_sha_verified: true
backend_ci: run 29880372748 success
pull_request: none
merged_to_main: false
staging_deployed: false
production_deployed: false
observation_window: none
```

## Gates already satisfied for the Feature 068 candidate

- 30/30 contracts and examples; OpenAPI 3.1.1.
- EVAL-SEARCH-API-001 24/24.
- EVAL-EVIDENCE-BUNDLE-API-001 24/24.
- Full suite 779 total / 777 pass / 0 fail / 2 explicit skips.
- Typecheck/build/Pages verification pass; both npm audits report zero vulnerabilities.
- Detached clean-checkout verification of the exact functional SHA.
- Fresh PostgreSQL 16.14/pgvector 0.8.5 migrations 001–015, non-owner RLS gate and compiled HTTP smoke.

## Blocking gates before any production release

1. Backend CI succeeded on the exact published SHA; preserve this evidence in any PR/release review.
2. Authorized real corpus acquisition, current scanning, ingestion and judged retrieval evaluation.
3. Human authority/vigencia/applicability review and contradiction resolution process.
4. Human IdP/session/SaaS surfaces and accessibility evidence.
5. Production infrastructure, secrets/workload identity, observability/SLOs, staging, load/HA and recovery/privacy operations.
6. External consumer contract suites.
7. Human-reviewed PR, protected merge, deployment approvals and observed rollout.

## Release rule

A green feature branch or local PostgreSQL gate is not a release. Production readiness may be declared only after every blocking gate has immutable evidence and the deployed revision is observed. No automatic merge or deployment is authorized by this plan.
