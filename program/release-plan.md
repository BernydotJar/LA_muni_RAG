# LA Muni RAG — Release Plan

Updated: 2026-07-22T20:47:22Z

## Current release state

```text
functional_branch: feature/public-query-gateway-v1
functional_sha: 856a6edee20cdb14a16a89d0d1a831faadbf166e
remote_sha_verified: true
backend_ci: run 29955124279 success
pull_request: none
merged_to_main: false
gcp_project_created: false
cloud_resources_created: false
staging_deployed: false
gateway_enabled: false
pages_api_bound: false
browser_e2e_executed: false
production_deployed: false
observation_window: none
```

## Feature 072 gates satisfied

- closed public request, response and error schemas;
- `POST /api/public/v1/query` implemented ahead of the legacy production gate;
- tenant and jurisdiction bound server-side;
- browser Authorization/Cookie and extra identity fields rejected;
- exact Origin allowlist and minimal CORS;
- keyword/phrase-only anonymous retrieval;
- global and HMAC per-client database rate buckets before retrieval;
- forced RLS and public/active/processed/accepted/clean evidence eligibility;
- comparative/validation-required evidence never promoted into a supported answer;
- HTTPS-only citations without userinfo, query or fragment;
- audit excludes query, excerpts, URLs, IP and user-agent;
- disabled-by-default configuration and no automatic Pages binding;
- 23/23 named eval;
- detached 842 total / 840 pass / 0 fail / 2 skips;
- 33/33 contracts, typecheck, build, Pages and zero-vulnerability audits;
- fresh PostgreSQL 16.14/pgvector 0.8.5 migrations 001–016, non-owner forced-RLS gate and compiled smoke;
- exact remote SHA and Backend CI success.

## Required sequence before public enablement

1. Approve and ingest a real public corpus with human authority/vigencia review.
2. Execute the staging runner and all twenty API/system journeys.
3. Configure exact staging origins, HMAC secret and public tenant binding.
4. Add Cloud Armor/WAF, quotas, load/SLO evidence, sanitized telemetry and alerts.
5. Provision guarded GCP staging only after project, billing, region and budget approval.
6. Deploy an immutable gateway revision and verify rollback.
7. Configure Pages `PAGES_API_URL` only after staging passes.
8. Run human usability/accessibility review before public launch.

## Required sequence before authenticated browser E2E

1. Coordinate consumer-side contract tests in OS Electoral and Content Agency.
2. Approve and implement IdP/OIDC/PKCE/BFF/session, secure cookies, CSRF, logout, revocation and recovery.
3. Build role-aware authenticated UI routes.
4. Enable bounded browser journeys and collect browser, keyboard, screen-reader and human accessibility evidence.

## Blocking release gates

- authorized real corpus acquisition, ingestion and judged retrieval quality;
- human authority/vigencia/applicability review;
- executed staging runner and cleanup evidence;
- edge protection, load/SLO and production telemetry;
- human identity/session and authenticated SaaS surfaces;
- external consumer conformance;
- approved GCP project/budget/region, guarded infrastructure, workload identity and secrets;
- HA, coordinated recovery and privacy operations;
- reviewed PR, protected merge, deployment approvals, rollout, rollback and observation.

## Release rule

A gateway implementation, green branch or disposable database gate is not a release. Production readiness requires immutable evidence for every blocking gate and observation of the deployed revision. No automatic merge, Terraform apply or production deployment is authorized.
