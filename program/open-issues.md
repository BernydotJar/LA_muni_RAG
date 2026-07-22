# LA Muni RAG — Open Issues

Updated: 2026-07-22T19:34:37Z

## Critical

### PPS-OPEN-GATEWAY-001 — public query gateway absent

`POST /api/public/v1/query` is the approved browser boundary but is not implemented. Production correctly returns 404 and the public widget remains disabled. Do not re-enable legacy `/api/chat` or place a tenant/integration credential in JavaScript.

Required closure:

- closed public request/response contract;
- server-bound public tenant/corpus;
- no tenant or credential input from the browser;
- exact CORS/origin, method, content type, body, timeout and rate/abuse controls;
- public-only accepted evidence eligibility;
- bounded citations and explicit no-evidence/degraded states;
- minimized audit/logging;
- PostgreSQL/RLS and compiled HTTP gates.

### BLK-CORPUS-OPS-001 — authorized corpus operations unavailable

The minimum Antigua-first and comparative corpus is incomplete. Zero documents are credited as ingested against a real, reviewed corpus.

Human/platform inputs required:

- source rights and acquisition approval;
- durable object storage;
- current malware scanner and definitions monitoring;
- retention, deletion and legal-hold policy;
- named source/authority reviewers.

### E2E-OPEN-IDP-002 — human identity/session absent

Browser authentication/session architecture, approved IdP/OIDC/PKCE/BFF, secure cookies/CSRF, provisioning, logout, revocation, recovery and role-aware navigation remain unimplemented.

### PROG-OPS-001 — production platform and operations absent

GCP is selected as target architecture only. No project, billing, Terraform apply, Cloud Run, Cloud SQL, Storage, queue, Secret Manager configuration, telemetry, load/HA, recovery or privacy operation exists.

## High

### E2E-OPEN-RUNNER-001 — staging contract not executed

The Feature 070 plan validates, but no runner has created/destroyed the environment or executed the twenty API/system journeys.

### E2E-OPEN-CONSUMERS-003 — external consumer suites absent

OS Electoral and Content Agency have not run the portable contract kits inside their own repositories. Provider-side stubs do not prove external consumer interoperability.

### PUBLIC-EDGE-001 — edge abuse and security controls unproved

The future public gateway needs WAF/Cloud Armor, global and per-instance rate controls, request limits, sanitized telemetry and load evidence. None is deployed.

### ACCESSIBILITY-HUMAN-001 — human accessibility evidence absent

Automated contrast/focus/reduced-motion tests pass, but no supported-browser, screen-reader or human WCAG review exists.

### OCR-EVAL-001 — OCR production candidate unbenchmarked

Unlimited-OCR is not a dependency. A future isolated benchmark must pin model/code revisions, use non-sensitive samples, measure accuracy/structure/hallucination/latency/cost and run outside the API process.

## Product boundaries

- EvidenceGap is intake-only: there is no research assignment, resolution lifecycle or notification workflow.
- No production object store, scanner/definitions monitor or dispatcher is operating.
- Legacy pre-v1 routes remain development-only and production-disabled.
- Pages contains no static municipal answers or procedure fixtures.
- OpenSEO is deferred until a production public domain and content policy exist.
- No PR, merge, staging deployment or production deployment has occurred.
