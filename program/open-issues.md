# LA Muni RAG — Open Issues

Updated: 2026-07-27T20:37:30Z

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

### E2E-OPEN-IDP-002 — productive human identity and authenticated UI absent

Feature 077 implements and locally verifies a provider-neutral BFF/session foundation with state/browser binding, nonce, PKCE S256, secure cookie policy, CSRF/bootstrap proof, rotation, logout, revocation, local membership mapping and minimized audit. It remains disabled by default. No productive IdP product or adapter/configuration, client registration/credential, discovery/JWKS/token interoperability, MFA/recovery, access review, role-aware authenticated UI or deployed browser environment exists. All twelve browser journeys remain explicitly blocked (`0/12`).

### GCP-EXECUTION-074 — managed restart window expired without a successful receipt

Authenticated controls, exact-plan apply and bounded stop are proven. A second restart window produced one transient startup failure; the fail-closed script reported temporary-user cleanup and return to `STOPPED`. The window expired without a successful managed-run receipt. Restart and destructive teardown now require new explicit authorization.

### PROG-OPS-001 — managed cloud and production operations absent

A protected Cloud SQL PostgreSQL 16 instance now exists and is stopped. Exact-plan apply and bounded stop are proved, but the managed synthetic run and teardown were not executed; the second restart authorization expired. No Cloud Run service, queue, Secret Manager configuration, telemetry, load/HA, managed recovery or privacy operation exists.


### HUMAN-SESSION-OPS-077 — productive session operations and retention absent

The local schema bounds login/code/session state and failure-bucket aging, but no scheduled purge, backup-aging proof, idle-timeout policy, device/session management, access-review operation, provider-account deletion mapping, telemetry alert, incident runbook or reverse-proxy Origin verification exists. These controls require approved deployment and privacy/security decisions.

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
