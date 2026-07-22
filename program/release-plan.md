# LA Muni RAG — Release Plan

Updated: 2026-07-22T21:54:35Z

## Current release state

```text
functional_branch: feature/ephemeral-staging-runner-v1
functional_sha: 4f6ab306d383f6d74808b393a88ff8172d666b5b
remote_sha_verified: true
backend_ci: run 29959965725 success
pull_request: none
merged_to_main: false
gcp_project_created: false
cloud_resources_created: false
cloud_staging_deployed: false
provider_side_staging_executed: true
gateway_enabled: false
pages_api_bound: false
browser_e2e_executed: false
production_deployed: false
observation_window: none
```

## Feature 073 gates satisfied

- canonical staging plan maps all twenty runnable API/system journeys exactly once;
- twelve browser journeys remain explicitly blocked and are not counted as passed;
- four fixed disposable `_test` databases and three non-owner runtime roles;
- loopback `/postgres`, explicit ephemeral confirmation and dedicated-cluster preflight;
- dirty environment preservation unless explicit cleanup is authorized;
- guarded repository SQL and compiled smoke scripts only;
- exact viewer, document-manager, platform-admin, tenant-admin, integration-client, author, reviewer, approver and case-operator personas;
- no shell and local dotenv disabled for child processes;
- reset by database recreation and empty source-list HTTP verification;
- clean-worktree requirement and closed sanitized receipt written mode `0600`;
- cleanup in `finally`, actual-resource counts and zero-residue postcondition;
- 14/14 named eval;
- detached 856 total / 854 pass / 0 fail / 2 skips;
- 33/33 contracts, typecheck, build and zero-vulnerability audits;
- PostgreSQL 16.14/pgvector 0.8.5 detached execution: 20/20, 12 blocked, cleanup 4/4 + 3/3;
- exact remote SHA and Backend CI success, including the real runner step.

## Required sequence before public enablement

1. Approve and ingest a real public corpus with human authority/vigencia review.
2. Add Cloud Armor/WAF, quotas, load/SLO evidence, sanitized telemetry and alerts.
3. Provision guarded GCP staging only after project, billing, region and budget approval.
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
