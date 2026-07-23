# LA Muni RAG — Release Plan

Updated: 2026-07-23T05:45:00Z

## Current release state

```text
functional_branch: feature/gcp-cloudsql-staging-v1
functional_sha: afa0a427080ed7b9555a9ee5a3c7c77d9a2067cd
remote_base_sha_verified: 7a00f3ee902cb6dd41c153d3ebfb7c943b50f7a1
prior_backend_ci: run 29980032034 success
prior_terraform_ci: run 29980032069 success
pull_request: 24 draft
merged_to_main: false
gcp_project_id_supplied: rag-municipalidades
gcp_project_number_supplied: 1059368783280
repository_created_project: false
cloud_resources_created: false
billable_actions: 0
cost_generated: USD 0
cloud_staging_deployed: false
provider_side_staging_executed: true
gateway_enabled: false
pages_api_bound: false
browser_e2e_executed: false
production_deployed: false
observation_window: none
```

## Feature 074 plan gates satisfied

- supplied project ID/number, region and Auth Proxy pilot recorded in a disabled example;
- committed project-specific plan produces zero resource changes;
- resource planning requires exact confirmation, billing, budget, residency and bounded cost review;
- approved offline shape contains only SQL Admin API enablement and one protected instance;
- PostgreSQL 16 Enterprise, IAM database auth, backups, PITR, bounded SSD, Query Insights and deletion protection;
- no SQL password, database-user resource, `terraform apply` or destroy automation;
- reviewed USD 0.06755/hour compute/memory estimate and maximum four-hour pilot;
- estimated USD 0.2702 compute/memory before storage, backups, network, taxes and other charges;
- 13/13 named Cloud SQL eval and 33/33 public-surface regression;
- full 869 total / 867 pass / 0 fail / 2 skips;
- 33/33 contracts, typecheck, build, Pages and zero-vulnerability audits;
- Terraform 1.15.8 format/init/validate passed;
- PR #24 remains draft; current checkpoint CI is not yet claimed.

A budget or estimate is not a hard spending cap. No live GCP plan, apply, API enablement,
resource, managed staging execution or cost is claimed.

## Required sequence before public enablement

1. Approve and ingest a real public corpus with human authority/vigencia review.
2. Add Cloud Armor/WAF, quotas, load/SLO evidence, sanitized telemetry and alerts.
3. Provision the guarded GCP pilot only after billing-owner, budget-alert, residency, IAM/state, current-price and explicit spend approval.
4. Deploy immutable gateway/API/worker revisions and execute the same twenty journeys against managed services.
5. Verify rollback and real-corpus quality.
6. Configure Pages `PAGES_API_URL` only after those gates pass.
7. Run human usability/accessibility review before public launch.

## Required sequence before authenticated browser E2E

1. Coordinate consumer-side contract tests in OS Electoral and Content Agency.
2. Approve and implement IdP/OIDC/PKCE/BFF/session, secure cookies, CSRF, logout, revocation and recovery.
3. Build role-aware authenticated UI routes.
4. Enable the twelve browser journeys and collect browser, keyboard, screen-reader and human accessibility evidence.

## Blocking release gates

- authorized real corpus acquisition, ingestion and judged retrieval quality;
- human authority/vigencia/applicability review;
- deployed cloud staging and immutable service revisions;
- edge protection, load/SLO and production telemetry;
- human identity/session and authenticated SaaS surfaces;
- external consumer conformance;
- approved GCP project/budget/region, guarded infrastructure, workload identity and secrets;
- HA, coordinated recovery and privacy operations;
- reviewed PR, protected merge, deployment approvals, rollout, rollback and observation.

## Release rule

A green synthetic staging receipt is not a release. Production readiness requires immutable evidence for every blocking gate and observation of the deployed revision. No automatic merge, Terraform apply or production deployment is authorized.
