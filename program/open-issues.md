# LA Muni RAG — Open Issues

Updated: 2026-07-22T21:54:35Z

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

### PROG-OPS-001 — cloud platform and production operations absent

GCP is architecture only. No project, billing, Terraform apply, Cloud Run, Cloud SQL, Storage, queue, Secret Manager configuration, telemetry, load/HA, recovery or privacy operation exists.

## High

### E2E-OPEN-CONSUMERS-003 — external consumer suites absent

OS Electoral and Content Agency have not run the portable kits inside their own repositories.

### STAGING-CLOUD-001 — provider-side disposable runner is not deployed staging

Feature 073 executes all twenty API/system journeys in a dedicated local/CI PostgreSQL service with synthetic fixtures and complete cleanup. It does not exercise cloud networking, workload identity, managed secrets, immutable deployed revisions, edge controls or real corpus.

### PUBLIC-EDGE-001 — edge protection and capacity unproved

Database-backed rate limits are defense in depth, not DDoS protection. Cloud Armor/WAF, quotas, load tests, latency/error SLOs and operational alerts remain required.

### ACCESSIBILITY-HUMAN-001 — human accessibility evidence absent

Automated contrast/focus/reduced-motion gates pass; supported-browser, keyboard, screen-reader and human WCAG review do not.

### OCR-EVAL-001 — OCR production candidate unbenchmarked

Unlimited-OCR remains evaluation-only pending pinned revisions, license/security review, sandboxing and non-sensitive accuracy/latency/cost benchmarks.

## Product boundaries

- EvidenceGap is intake-only.
- No production object store, scanner/definitions monitor or dispatcher operates.
- Legacy pre-v1 routes remain development-only and production-disabled.
- Pages contains no static municipal answers or procedure fixtures.
- Gateway is disabled by default and no real public corpus is bound.
- OpenSEO remains deferred until a production public domain and content policy exist.
- No PR, merge, cloud staging deployment or production deployment has occurred.
