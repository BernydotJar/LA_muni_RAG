# LA Muni RAG — Open Issues

Updated: 2026-07-29T17:34:00Z

## Critical

### PQG-OPEN-ENABLEMENT-001 — public gateway cannot be enabled yet

`POST /api/public/v1/query` is implemented and its API/system path is included in disposable staging, but it remains disabled and undeployed.

Required closure:

- authorized, reviewed and ingested public tenant corpus;
- exact production origins and gateway configuration;
- Cloud Armor/WAF and edge/global abuse controls;
- deployed staging, load evidence, sanitized telemetry and alerting;
- deployment approval and immutable revision receipt;
- Pages `PAGES_API_URL` configured only after those gates pass.

### BLK-CORPUS-OPS-001 — partially resolved controlled corpus; productive operations incomplete

Feature 085 credits one exact, clean PDM-OT document as ingested with 224 sections and 444 tenant-scoped chunks. DMP v3 is exact and clean but remains failed with `pdf_no_extractable_text`; no OCR or chunks are credited. Still required:

- approved OCR accuracy and human review for scanned legal documents;
- durable immutable production object storage and definitions monitoring;
- retention, deletion and legal-hold policy;
- broader Antigua-first and comparative source coverage;
- named source, authority and vigencia reviewers;
- managed ingestion operations and observation.

### E2E-OPEN-IDP-002 — productive human identity and authenticated UI absent

Features 077 and 083 implement and locally verify a provider-neutral BFF/session foundation plus a generic confidential discovery/JWKS/token adapter. Composition remains disabled by default. No productive IdP selection, provider-specific configuration, client registration/credential, external interoperability, MFA/recovery, access review or deployed browser environment exists. A local role-aware shell exists but is test-adapter-only and does not implement complete productive workflows. All twelve browser journeys remain explicitly blocked (`0/12`).

### GCP-EXECUTION-074 — managed restart window expired without a successful receipt

Authenticated controls, exact-plan apply and bounded stop are proven. A second restart window produced one transient startup failure; the fail-closed script reported temporary-user cleanup and return to `STOPPED`. The window expired without a successful managed-run receipt. Restart and destructive teardown now require new explicit authorization.

### PROG-OPS-001 — managed cloud and production operations absent

A protected Cloud SQL PostgreSQL 16 instance now exists and is stopped. Exact-plan apply and bounded stop are proved, but the managed synthetic run and teardown were not executed; the second restart authorization expired. No Cloud Run service, queue, Secret Manager configuration, telemetry, load/HA, managed recovery or privacy operation exists.


### HUMAN-SESSION-OPS-077 — productive session operations and retention absent

The local schema bounds login/code/session state and failure-bucket aging, but no scheduled purge, backup-aging proof, idle-timeout policy, device/session management, access-review operation, provider-account deletion mapping, telemetry alert, incident runbook or reverse-proxy Origin verification exists. These controls require approved deployment and privacy/security decisions.


### HUMAN-WORKSPACE-082 — productive authenticated workflows remain absent

Features 078–082 verify a local task-first shell, exact deep-link login return, role-aware
navigation, history, recovery and cross-browser accessibility behavior. The shell panels are
honest route/readiness foundations, not complete browser-to-domain workflows. No productive
IdP, managed ephemeral browser environment, external municipal user or productive journey
receipt exists; the official count remains `0/12`.

### HUMAN-OBSERVABILITY-079 — productive SLO and operations absent

Local low-cardinality telemetry and failure-injection/load evidence pass, but no approved
exporter, retention, dashboards, alerting, error budget, incident ownership, on-call or
representative TLS/ingress/IdP/Cloud SQL load exists.

### HUMAN-DECISIONS-080 — required human receipts absent

The IdP, corpus, Cloud SQL lifecycle and production-control packets remain pending with zero
selected options and zero authorized actions. No packet authenticates authority or permits
execution by itself.

### BRANCH-PUBLICATION-083 — resolved with exact-SHA CI

Features 077–083 and localized repair `82d75711f28a03de4e7df35d5ec6435cc7610319` are published on the draft PR branch through audited non-forced fast-forward pushes. Backend CI `30428162887`, Public Browser Gate `30428162850` and Terraform validation `30428162725` all succeeded for the exact repair SHA. This closes branch publication only; merge and release remain unauthorized.

### GRAPH-HARNESS-PIN-001 — resolved with immutable published runtime

Graph Harness SDLC is pinned to published merge `1bebce3db35303072049233786464bb01163c98b`, which contains executable runtime commit `fef364bc66849b98c08d3c1dcb91caf9701027cd`. Backend CI `30470555533` installed that exact package, replayed the application ledger and passed `EVAL-GRAPH-HARNESS-RUNTIME-PIN-001`; Public Browser `30470546856` and Terraform `30470549087` also passed. No framework runtime source was copied into LA Muni RAG.
## High

### PAGES-ONLINE-ROLLBACK-001 — closed with verified rollback

Rollback workflow `30229913868` restored exact main SHA `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`. The latest `github-pages` deployment references that SHA, the public URL responds HTTP 200, the temporary candidate metadata is absent, and the environment allowlist contains only `main`. The product owner reported completing the bounded manual smoke review; this does not replace human WCAG, screen-reader, authenticated-session or legal review. Any future Pages replacement requires a new exact-SHA, time-bounded authorization.

### E2E-OPEN-CONSUMERS-003 — external consumer suites absent

OS Electoral and Content Agency have not run the portable kits inside their own repositories.

### STAGING-CLOUD-001 — provider-side disposable runner is not deployed staging

Feature 073 executes all twenty API/system journeys in a dedicated local/CI PostgreSQL service with synthetic fixtures and complete cleanup. It does not exercise cloud networking, workload identity, managed secrets, immutable deployed revisions, edge controls or real corpus.

### PUBLIC-EDGE-001 — edge protection and capacity unproved

Database-backed rate limits are defense in depth, not DDoS protection. Cloud Armor/WAF, quotas, load tests, latency/error SLOs and operational alerts remain required.

### ACCESSIBILITY-HUMAN-001 — human accessibility evidence absent

Automated contrast plus Chromium desktop/mobile focus, keyboard, reduced-motion and fail-closed public-surface gates pass. Firefox/WebKit automated checks pass; screen-reader and human WCAG review do not.

### OCR-EVAL-001 — OCR production candidate unbenchmarked

Unlimited-OCR remains evaluation-only pending pinned revisions, license/security review, sandboxing and non-sensitive accuracy/latency/cost benchmarks.

## Product boundaries

- EvidenceGap is intake-only.
- No production object store, scanner/definitions monitor or dispatcher operates.
- Legacy pre-v1 routes remain development-only and production-disabled.
- Pages contains no static municipal answers or procedure fixtures.
- Gateway is disabled by default and no real public corpus is bound.
- OpenSEO remains deferred until a production public domain and content policy exist.
- PR #24 exists as a draft; no protected merge, cloud staging deployment or production deployment has occurred.


### BLK-GCP-LIFECYCLE-074 — stopped pilot requires a new lifecycle authorization

The exact authorized instance exists in `STOPPED` state with activation policy `NEVER` and
deletion protection enabled. The second temporary restart exception expired at 17:25 America/Guatemala without a
successful managed-run receipt. Restart and destructive teardown are unauthorized.
Storage, backup and related charges may continue while the instance remains.
