# LA Muni RAG — Open Issues

Updated: 2026-07-26T23:00:13Z

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

### BLK-CORPUS-OPS-001 — authorized corpus operations unavailable

Zero real documents are credited as ingested. Human/platform inputs required:

- source rights and acquisition approval;
- durable immutable object storage;
- current malware scanner and definitions monitoring;
- retention, deletion and legal-hold policy;
- named source, authority and vigencia reviewers.

### E2E-OPEN-IDP-002 — human identity/session absent

No approved IdP/OIDC/PKCE/BFF, secure cookie/CSRF, provisioning, logout, revocation, recovery or role-aware authenticated UI exists. All twelve browser journeys remain explicitly blocked.

### GCP-EXECUTION-074 — managed restart window expired without a successful receipt

Authenticated controls, exact-plan apply and bounded stop are proven. A second restart window produced one transient startup failure; the fail-closed script reported temporary-user cleanup and return to `STOPPED`. The window expired without a successful managed-run receipt. Restart and destructive teardown now require new explicit authorization.

### PROG-OPS-001 — managed cloud and production operations absent

A protected Cloud SQL PostgreSQL 16 instance now exists and is stopped. Exact-plan apply and bounded stop are proved, but the managed synthetic run and teardown were not executed; the second restart authorization expired. No Cloud Run service, queue, Secret Manager configuration, telemetry, load/HA, managed recovery or privacy operation exists.

## High

### PAGES-ONLINE-ROLLBACK-001 — temporary exact-SHA Pages deployment awaits rollback

The legacy publication was rejected, and exact SHA `b646aa6ce5d7231587ae311f5acb59f84fc35a0e` is now temporarily deployed
at https://bernydotjar.github.io/LA_muni_RAG/ with `PAGES_API_URL` absent. Deployment run `30226975010` and independent Chromium
desktop/mobile checks passed. The temporary branch policy was removed after deployment. Rollback
to `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c` is scheduled for 2026-07-27T01:14:34Z and remains the active gate.

### E2E-OPEN-CONSUMERS-003 — external consumer suites absent

OS Electoral and Content Agency have not run the portable kits inside their own repositories.

### STAGING-CLOUD-001 — provider-side disposable runner is not deployed staging

Feature 073 executes all twenty API/system journeys in a dedicated local/CI PostgreSQL service with synthetic fixtures and complete cleanup. It does not exercise cloud networking, workload identity, managed secrets, immutable deployed revisions, edge controls or real corpus.

### PUBLIC-EDGE-001 — edge protection and capacity unproved

Database-backed rate limits are defense in depth, not DDoS protection. Cloud Armor/WAF, quotas, load tests, latency/error SLOs and operational alerts remain required.

### ACCESSIBILITY-HUMAN-001 — human accessibility evidence absent

Automated contrast plus Chromium desktop/mobile focus, keyboard, reduced-motion and fail-closed public-surface gates pass. Firefox/WebKit, screen-reader and human WCAG review do not.

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
