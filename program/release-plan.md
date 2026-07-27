# LA Muni RAG — Release Plan

Updated: 2026-07-27T20:37:30Z

## Current release state

```text
functional_branch: feature/gcp-cloudsql-staging-v1
functional_candidate_sha: 1af3f0ecdca4fe49b47e5e1209f563c30a314adf
remote_parent_sha: f858cecab6b24b00ad625c3986fbc03d347ef59e
working_tree_at_handoff: clean
push_status: functional_commit_local_pending_program_checkpoint_and_publication
pull_request: 24 draft, open, mergeable, CLEAN
merged_to_main: false
cloud_sql_instance_created: true
cloud_sql_instance_state: STOPPED
cloud_sql_activation_policy: NEVER
terraform_apply_executed: true
managed_cloud_staging_executed: false
cloud_sql_teardown_executed: false
public_browser_gate: 10/10 Chromium desktop/mobile
online_pages_exact_sha_pilot: completed_and_verified
online_pages_rollback: completed_to_4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
pages_api_bound: false
human_session_bff: local_provider_neutral_foundation_verified_disabled_by_default
authenticated_browser_journeys: 0/12 blocked
real_documents_ingested: 0
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

## Feature 077 provider-neutral human session/BFF checkpoint

- Functional commit: `1af3f0ecdca4fe49b47e5e1209f563c30a314adf`.
- Focused lifecycle/migration tests: 20/20; `EVAL-HUMAN-SESSION-BFF-001`: 9/9.
- Integrated regression: 908 total / 905 pass / 0 fail / 3 explicit environment skips; typecheck and build pass.
- PostgreSQL 15.18/pgvector 0.8.5 non-owner `NOSUPERUSER/NOBYPASSRLS` gate and compiled smoke pass.
- Browser Bearer is rejected; state/browser binding, nonce, PKCE S256, code replay, fixation, bootstrap/CSRF, rotation, expiry, revocation, ambiguous tenant mapping, local-role-only mapping and minimized audit are covered.
- Contracts, inventory, workflow, JSON/YAML/JSONL/CI YAML, dependency audit, secret/PII scan and diff checks pass.
- Default is disabled; no productive IdP, external OIDC interoperability, client credential, MFA/recovery/access review, role-aware UI, authenticated journey, merge or deployment is claimed.
- Authenticated browser result remains `0/12`; this checkpoint is not production readiness.

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
2. Approve a productive IdP and implement the provider adapter/configuration, client registration, discovery/JWKS/token validation, MFA/recovery and access-review operations against the verified BFF contract.
3. Build role-aware authenticated UI routes; local deterministic-provider execution remains test evidence only.
4. Enable the twelve browser journeys only in a real ephemeral environment and collect cross-browser, keyboard, screen-reader and human accessibility evidence.

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
- Feature 076 deployment authorization was consumed for the exact temporary SHA and observation window.
- Rollback to the authorized main SHA completed and was verified before closure.


## Feature 076 temporary online deployment receipt

- Authorized source SHA: `b646aa6ce5d7231587ae311f5acb59f84fc35a0e`.
- First dispatch `30226914441`: rejected before publication by the `github-pages` branch policy.
- Temporary exact-branch policy: created for one deployment and removed after success; only `main` remains allowed.
- Successful deployment run: `30226975010`.
- Public URL: https://bernydotjar.github.io/LA_muni_RAG/
- Exact-SHA online verification: 2/2 Chromium desktop/mobile, workflow and independent sandbox checks.
- `PAGES_API_URL`: absent; public assistant remains fail-closed.
- Rollback target: `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c` at 2026-07-27T01:14:34Z.
- No merge, backend deployment, Cloud SQL, Terraform or destructive operation occurred.


## Feature 076 rollback receipt

- Rollback workflow run: `30229913868` from `main`.
- Exact rollback SHA: `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`.
- Latest `github-pages` deployment SHA: `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`.
- Public URL response: HTTP 200.
- Candidate metadata removed: `build-metadata.json` returned 404 and `b646aa6ce5d7231587ae311f5acb59f84fc35a0e` was absent from public HTML.
- The `github-pages` environment allowlist contains only `main`.
- No merge, backend deployment, Cloud SQL restart, Terraform action or destructive infrastructure operation occurred.
