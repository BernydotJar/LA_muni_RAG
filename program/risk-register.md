# LA Muni RAG — Program Risk Register

Updated: 2026-07-22T20:47:22Z

| ID | Severity | Risk | Current control/evidence | Residual action |
|---|---|---|---|---|
| R-PUBLIC-01 | critical | Public frontend fabricates municipal evidence | static fixtures removed; Pages and widget fail closed | preserve fail-closed assets and bind only to reviewed gateway revision |
| R-PUBLIC-02 | critical | Browser supplies tenant/service identity | closed request; Authorization/Cookie rejected; server-bound tenant; 23/23 | preserve contract and add deployment-level security review |
| R-PUBLIC-03 | critical | Gateway exposes foreign tenant/private corpus | forced RLS, non-owner role, strict eligibility and cross-tenant smoke pass | authorized corpus review, staging and penetration testing |
| R-PUBLIC-04 | critical | Implemented gateway is enabled prematurely | disabled by default; no Pages binding or deployment | require corpus, edge, staging, load and deployment approvals |
| R-CORPUS-01 | critical | Incomplete/unlicensed corpus is treated as authority | 17/4/1/0 inventory truth and zero-ingestion statements | approve rights, storage, scan and reviewers; ingest exact bytes |
| R-AUTH-01 | critical | Service credentials are reused as human sessions | gateway rejects browser credentials; browser journeys blocked | approve IdP/OIDC/PKCE/BFF/session and secure-cookie design |
| R-CLOUD-01 | critical | Cloud creation causes uncontrolled cost or exposure | GCP architecture only; zero resources/billable actions | project/budget/region approval, guarded Terraform, quotas and budgets |
| R-OPS-01 | critical | Feature CI is mistaken for production readiness | current-state/release docs deny merge/deploy/observation | immutable staging/deployment/observation receipts required |
| R-RATE-01 | high | Database rate limits are mistaken for DDoS defense | global/per-client HMAC buckets before retrieval | Cloud Armor/WAF, quotas, load tests and alerts |
| R-RETRIEVAL-01 | high | Synthetic gates overstate real retrieval quality | no real-corpus credit; explicit limitations | judged corpus, human citation review and latency/load/cost SLOs |
| R-EVIDENCE-01 | high | Comparative or stale evidence is promoted | conservative classification; comparative never supports answer | human authority/vigencia/jurisdiction/applicability workflow |
| R-PRIVACY-01 | high | Query/network identity enters logs | audit allowlist and HMAC-only rate identity | deployment log review, retention/deletion and DSAR operations |
| R-E2E-01 | high | Browser E2E hides lower-layer defects | explicit API-versus-browser ownership | execute staging runner first; keep browser suite bounded |
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
- staging runner not executed;
- browser authentication/session architecture absent;
- GCP infrastructure/edge/observability/load/recovery/privacy evidence absent;
- external consumer suites absent;
- reviewed PR, protected merge, deployment and observation absent.
