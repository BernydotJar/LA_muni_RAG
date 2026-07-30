# LA Muni RAG — Release Plan

Updated: 2026-07-29T06:42:07Z

## Current release state

```text
functional_branch: feature/gcp-cloudsql-staging-v1
functional_candidate_sha: 82d75711f28a03de4e7df35d5ec6435cc7610319
remote_parent_sha: ba6acf3cc654e798f46b104d4eaac6d5c78712ab
working_tree_at_handoff: clean
push_status: audited_non_forced_fast_forward_published_exact_sha_ci_passed
pull_request: 24 draft, open, mergeable, CLEAN
merged_to_main: false
cloud_sql_instance_created: true
cloud_sql_instance_state: STOPPED
cloud_sql_activation_policy: NEVER
terraform_apply_executed: true
managed_cloud_staging_executed: false
cloud_sql_teardown_executed: false
public_browser_gate: 10/10 Chromium desktop/mobile; exact-SHA run 30428162850 success
online_pages_exact_sha_pilot: completed_and_verified
online_pages_rollback: completed_to_4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c
pages_api_bound: false
human_session_bff: provider_neutral_foundation_and_generic_oidc_adapter_published_verified_disabled_by_default
graph_harness_project: la-muni-rag-pr24-repair-20260729
graph_harness_state: 43 events; 2 repair plans; 4/4 required gates PASS; 1 checkpoint
graph_harness_framework_pin: pending_immutable_framework_commit
exact_sha_backend_ci: 30428162887 success
exact_sha_terraform_validation: 30428162725 success
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


## Features 078–082 accumulated checkpoint

- Feature 078 functional SHA: `442623e05308011d7384f2b2fcbe779775898b67`.
- Feature 079 functional SHA: `04dbb125c15e9c429e7319a6506bfd787f51d940`.
- Feature 080 functional SHA: `706109c3820dba326573ddc796d9a0095e5446eb`.
- Feature 081 functional SHA: `282b2441912828b193f82133543c4823f5f14659`.
- Feature 082 functional SHA: `ffa30433db9ba62812dd0dac680963759b4868cb`.
- Focused/named gates: shell 8/8 + 9/9; reliability 5/5 + 9/9; decision packets 9/9; accessibility 6/6 + 9/9; workspace 6/6 + 8/8.
- Public browser: 10/10; authenticated local shell: Chromium, Firefox and WebKit pass.
- PostgreSQL 15.18 / pgvector 0.8.5 non-owner forced-RLS gate and compiled BFF smoke pass.
- Integrated regression at the Feature 082 checkpoint: 978 total / 976 pass / 0 fail / 2 explicit environment skips; the current integrated gate after Feature 083 and the Graph Harness repair is 997 total / 995 pass / 0 fail / 2 explicit environment skips.
- Typecheck, build, contracts, consumer kits, staging plan, source inventory, decision packets, canonical workflow template, dependency audits, JSON/YAML/JSONL, secret/PII and diff gates pass.
- Productive IdP, real corpus, complete workflows, human accessibility acceptance, managed staging receipt, protected merge and production release remain absent. The branch publication checkpoint is complete and exact-SHA CI is green. Productive journeys stay `0/12`.

## Feature 083 provider-neutral OIDC adapter checkpoint

- Functional SHA: `7ec7037af4af5601c5c515be1bdf4aef35682a0a`.
- Focused adapter tests: 10/10; `EVAL-HUMAN-OIDC-PROVIDER-001`: 9/9.
- Path-aware discovery, exact endpoint origins, PKCE S256, confidential exchange, bounded reads, public asymmetric JWKS, issuer/audience/`azp`/time validation and URI-bound key caching pass.
- Provider roles, groups, tenant and profile claims are ignored; local memberships remain authoritative.
- Integrated regression: 997 total / 995 pass / 0 fail / 2 explicit environment skips.
- Public browser 10/10; Chromium, Firefox and WebKit deterministic authenticated smoke pass.
- Typecheck, build, contracts, kits, inventory, packets, dependency audits, JSON/YAML/JSONL, secret/PII and diff gates pass.
- No provider is selected, provisioned or approved; productive registration, credentials, external interoperability, MFA/recovery/access review, managed users/environment, merge and deployment remain absent. Productive journeys remain `0/12`.

## Graph Harness exact-SHA CI repair checkpoint

- Functional repair SHA: `82d75711f28a03de4e7df35d5ec6435cc7610319`; parent `ba6acf3cc654e798f46b104d4eaac6d5c78712ab`.
- Graph Harness project: `la-muni-rag-pr24-repair-20260729`.
- Persisted state: 43 events, two localized repair plans, four required gates `PASS`, one checkpoint.
- Backend CI run `30428162887`: success.
- Public Browser Gate run `30428162850`: success.
- Terraform validation run `30428162725`: success.
- Reliability threshold remained 500 ms measured shell p95; 12 validated warm-up requests are excluded from steady-state samples.
- The 320-pixel reflow gate now forces classic scrollbar reservation and retains overflow ≤1 pixel.
- Feature 083 OIDC was preserved as an independent done node.
- Productive authenticated journeys remain `0/12`; real corpus ingestion remains `0`; merge and deployment remain absent.
- Framework runtime pin remains open because observed Graph Harness executable files were uncommitted at `0eb0d5fe09e3b1ecaf561b4a1cc9b32510480a26`.

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
2. Approve a productive IdP, register the exact client/callback, provision managed credentials, execute external discovery/JWKS/token interoperability, and define MFA/recovery and access-review operations against the verified generic adapter and BFF contract.
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
