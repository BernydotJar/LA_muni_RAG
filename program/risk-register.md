# LA Muni RAG — Program Risk Register

Updated: 2026-07-23T05:45:00Z

| ID | Severity | Risk | Current control/evidence | Residual action |
|---|---|---|---|---|
| R-STAGING-01 | critical | Runner mutates a non-test database service | loopback `/postgres`, explicit confirmation, dedicated-cluster rejection and fixed names | use isolated managed staging account/project before cloud execution |
| R-STAGING-02 | critical | Interrupted run leaves resources | finally cleanup, actual existence counts, postcondition query, next-run guarded cleanup | host crash may require explicit cleanup of fixed test names |
| R-STAGING-03 | high | Synthetic staging is mistaken for cloud/production | receipt/docs preserve browser/cloud/corpus limitations | require deployed-revision and real-corpus receipts |
| R-PUBLIC-01 | critical | Public frontend fabricates municipal evidence | static fixtures removed; Pages/widget fail closed | bind only after reviewed corpus and gateway deployment |
| R-PUBLIC-02 | critical | Browser supplies tenant/service identity | closed request and server-bound tenant; staged gateway path | deployment security review and penetration test |
| R-CORPUS-01 | critical | Incomplete/unlicensed corpus is treated as authority | 17/4/1/0 truth and zero-ingestion statements | approve rights, storage, scan and reviewers; ingest exact bytes |
| R-AUTH-01 | critical | Service credentials are reused as human sessions | browser journeys remain blocked | approve IdP/OIDC/PKCE/BFF/session and secure-cookie design |
| R-CLOUD-01 | critical | Cloud creation causes uncontrolled cost or exposure | zero-resource default, exact confirmation, independent approvals, four-hour cost envelope, named stop owner and zero billable actions | real budget alerts, current price review, IAM/state ownership and live-plan approval |
| R-CLOUD-02 | critical | USD 1 or a budget alert is mistaken for a hard cap | docs and Terraform outputs state estimates/alerts are planning controls; persistent selected tier rejected; Eduardo Sacahui owns stop/teardown | actual billing observation and direct GCP control verification remain required |
| R-OPS-01 | critical | Feature CI is mistaken for production readiness | current-state/release docs deny merge/deploy/observation | immutable cloud deployment/observation receipts required |
| R-RATE-01 | high | Database rate limits are mistaken for DDoS defense | global/per-client HMAC buckets | Cloud Armor/WAF, quotas, load tests and alerts |
| R-RETRIEVAL-01 | high | Synthetic gates overstate real retrieval quality | no real-corpus credit | judged corpus, human citation review and latency/load/cost SLOs |
| R-EVIDENCE-01 | high | Comparative or stale evidence is promoted | conservative classification; comparative never supports answer | human authority/vigencia/jurisdiction/applicability workflow |
| R-PRIVACY-01 | high | Query/network identity enters logs | audit allowlist, HMAC rate identity and sanitized staging receipt | deployment log review, retention/deletion and DSAR operations |
| R-CONSUMER-01 | high | Provider stubs imply external interoperability | kits are provider-side only | run suites in OS Electoral and Content Agency |
| R-A11Y-01 | high | Glass/motion makes UI inaccessible | contrast, focus and reduced-motion gates | browser/screen-reader/human WCAG review |
| R-STORAGE-01 | high | Unsafe artifacts enter ingestion | acceptance/scan contracts and no production claim | deploy immutable storage, scanner and definitions monitoring |
| R-RESTORE-01 | high | Logical DB restore implies complete DR | disposable DB drill explicitly limited | object, PITR, KMS, RPO/RTO, HA and human exercise |
| R-OCR-01 | high | OCR model leaks data or hallucinates structure | Unlimited-OCR evaluation-only | isolated pinned benchmark and security/license review |
| R-SEO-01 | medium | SEO tooling expands surface prematurely | OpenSEO deferred | assess after domain/content policy and threat review |

## Current stop conditions

Production declaration is prohibited while any of these remain true:

- gateway disabled or not bound to an authorized real corpus;
- zero authorized real documents credited as ingested;
- browser identity/session and role-aware UI absent;
- managed cloud staging execution and edge/load/telemetry evidence absent;
- external consumer suites absent;
- reviewed PR, protected merge, deployment and observation absent.
