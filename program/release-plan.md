# LA Muni RAG — Release Plan

Updated: 2026-07-22T19:34:37Z

## Current release state

```text
functional_branch: feature/production-public-surface-v1
functional_sha: bf29e6fdc48fa155b004b5f0b2ff410050b59c84
remote_sha_verified: true
backend_ci: run 29951023165 success
pull_request: none
merged_to_main: false
gcp_project_created: false
cloud_resources_created: false
staging_deployed: false
browser_e2e_executed: false
production_deployed: false
observation_window: none
```

## Feature 071 gates satisfied

- presentation-only public sections removed;
- Assistant and Glass Wall exposed directly in the primary menu;
- modular public CSS/JavaScript and embeddable widget preserved;
- tested text/CTA/panel contrast ratios exceed 4.5:1;
- visible keyboard focus, reduced motion and responsive mobile stacking;
- static answer, citation, procedure and domain fixtures removed from Pages;
- unconfigured Pages calls fail closed with bounded HTTP 503;
- widget controls remain disabled without explicit API configuration;
- default browser boundary is `/api/public/v1/query`, not legacy `/api/chat`;
- production continues to return 404 until the dedicated public gateway exists;
- GCP Cloud Run/Cloud SQL target documented without resource creation or cost;
- OpenSEO deferred, Unlimited-OCR restricted to an isolated future evaluation and original `DESIGN.md` adopted;
- 33/33 `EVAL-PRODUCTION-PUBLIC-SURFACE-001`;
- detached full suite 818 total / 816 pass / 0 fail / 2 skips;
- 30/30 contracts, 2/5 consumer kits, typecheck, build, Pages verification and both audits pass;
- exact remote SHA and Backend CI success.

## Required sequence before public enablement

1. Implement and verify `POST /api/public/v1/query`.
2. Bind one reviewed public tenant/corpus server-side and accept no browser tenant or credential input.
3. Add origin, request-size, timeout, abuse/rate, audit-minimization and dependency-failure controls.
4. Acquire and ingest an authorized public corpus; complete judged retrieval and human source review.
5. Execute the ephemeral staging runner and twenty API/system journeys.
6. Provision guarded GCP staging only after project, billing, region and budget approval.
7. Configure the Pages `PAGES_API_URL` variable only after the gateway passes staging.

## Required sequence before browser E2E

1. Complete public gateway and staging execution.
2. Coordinate consumer-side contract tests in OS Electoral and Content Agency.
3. Approve and implement IdP/OIDC/PKCE/BFF/session, secure cookies, CSRF, logout, revocation and recovery.
4. Build role-aware authenticated UI routes.
5. Enable bounded browser journeys and collect browser, keyboard, screen-reader and human accessibility evidence.

## Blocking release gates

- dedicated public query gateway;
- authorized real corpus acquisition, ingestion and judged retrieval quality;
- human authority/vigencia/applicability review;
- executed staging runner and cleanup evidence;
- human identity/session and authenticated SaaS surfaces;
- external consumer conformance;
- approved GCP project/budget/region, guarded infrastructure, workload identity and secrets;
- observability, load/HA, coordinated recovery and privacy operations;
- reviewed PR, protected merge, deployment approvals, rollout, rollback and observation.

## Release rule

A public shell, cloud blueprint, green feature branch or disposable gate is not a release. Production readiness may be declared only when every blocking gate has immutable evidence and the deployed revision is observed. No automatic merge, Terraform apply or production deployment is authorized.
