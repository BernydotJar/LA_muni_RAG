# LA Muni RAG — Release Plan

Updated: 2026-07-23T05:45:00Z

## Current release state

```text
functional_branch: feature/gcp-cloudsql-staging-v1
functional_sha: afa0a427080ed7b9555a9ee5a3c7c77d9a2067cd
remote_program_checkpoint_sha: 5e265e41fe313136c49ebdeedd53a86a61b6f718
remote_head_sha: 5e265e41fe313136c49ebdeedd53a86a61b6f718
push_status: published_through_program_checkpoint
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
- reviewed USD 0.08775/hour compute/memory estimate and maximum four-hour pilot;
- estimated USD 0.351 compute/memory and USD 0.38826024 including 20 GiB SSD before backups, network, taxes and other charges;
- 14/14 named Cloud SQL eval and 33/33 public-surface regression;
- full 870 total / 868 pass / 0 fail / 2 skips;
- 33/33 contracts, typecheck, build, Pages and zero-vulnerability audits;
- Terraform 1.15.8 format/init/validate passed;
- PR #24 remains draft at `0edf935c7c012d86b2becae4da563046de167903`; Terraform validation runs 30164809307/30164807345 and Backend CI runs 30164809354/30164807333 succeeded.

A budget or estimate is not a hard spending cap. The exact immutable plan is authorized only for 2026-07-25 09:00-13:00 America/Guatemala under a temporary single-owner exception. No Terraform apply, API enablement, Cloud SQL resource, managed staging execution or cost is claimed until receipts exist.

## Required sequence before public enablement

1. Approve and ingest a real public corpus with human authority/vigencia review.
2. Add Cloud Armor/WAF, quotas, load/SLO evidence, sanitized telemetry and alerts.
3. Provision the guarded GCP pilot only through the exact hash-bound applicator during the authorized 09:00-13:00 America/Guatemala window, then record apply and teardown receipts.
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


## Feature 075 public browser gate checkpoint

- Published functional SHA: `2232147de0c6869e3f3452cf2d9bf1abe3e14120`.
- Public Browser Gate runs 30180490148 and 30180488768 succeeded.
- Backend CI runs 30180490197 and 30180488753 succeeded; Terraform validation run 30180490141 succeeded.
- Local browser evidence: 10/10 Chromium desktop/mobile executions; integrated regression 875 total / 873 passed / 0 failed / 2 environment skips.
- Scope remains public Pages only. Twelve authenticated role-aware browser journeys remain blocked.
- No merge, deployment, Cloud SQL restart or destructive teardown is authorized by this checkpoint.


## Feature 076 online Pages release verification

- Published Feature 076 functional SHA: `9a823b2311633f8b682d13d495ccacfb7ac3615f`; Backend CI 30224476425/30224475379, Public Browser Gate 30224476426/30224475314, and Terraform validation 30224476434 succeeded.
- Current public URL inspection: HTTP 200 but legacy main/Jekyll content, not the product artifact.
- Missing online controls observed: exact SHA metadata, product navigation, widget, favicon, and focusable product main target; one resource 404.
- Exact-SHA loopback verification passes in Chromium desktop/mobile.
- The legacy public site is rejected because `build-metadata.json` returns 404.
- Future Pages deploys build with `github.sha` and run post-deploy Chromium verification against the deployment output URL.
- No deployment is authorized or executed by Feature 076. Workflow dispatch from a feature branch would replace the only public Pages site.
- Required human gate: exact source SHA, public review window, fail-closed API posture, rollback SHA/ref, and rollback owner.
