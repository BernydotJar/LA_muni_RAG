# LA Muni RAG — Release Plan

Updated: 2026-07-22T01:05:41Z

## Current release state

```text
functional_branch: feature/consumer-contract-kit-v1
functional_sha: 5e5481e26b1a27a0aa2bd9c965e1c160f18b3198
remote_sha_verified: true
backend_ci: run 29882062536 success
pull_request: none
merged_to_main: false
staging_deployed: false
production_deployed: false
observation_window: none
```

## Feature 069 gates satisfied locally

- 16/16 EVAL-CONSUMER-CONTRACT-KIT-001.
- 2 consumer kits / 5 interactions / 0 issues.
- 30/30 canonical schemas/examples and OpenAPI 3.1.1.
- Full suite 795 total / 793 pass / 0 fail / 2 explicit skips.
- Clean detached verification of the exact functional SHA.
- Typecheck/build and all/prod dependency audits pass.

## Required sequence before E2E

1. Consumer repositories pin the exact kit SHA and pass equivalent contract tests.
2. Human identity/session architecture is approved and implemented.
3. Isolated staging has deterministic tenants, credentials and resettable data.
4. System/API journeys pass auth, isolation, replay, expiry and failure/retry.
5. Browser E2E then validates only critical user outcomes and role boundaries.

## Blocking release gates

- authorized real corpus and judged retrieval quality;
- human authority/applicability review;
- production infrastructure, observability, staging, load/HA and recovery/privacy;
- external consumer conformance;
- browser/accessibility evidence;
- reviewed PR, protected merge, approvals, deployment and observation.

A green feature branch is not a release. No automatic merge or deployment is authorized by this plan.
