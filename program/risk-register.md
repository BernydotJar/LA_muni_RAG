# LA Muni RAG — Program Risk Register

Updated: 2026-07-22T19:34:37Z

| ID | Severity | Risk | Current control/evidence | Residual action |
|---|---|---|---|---|
| R-PUBLIC-01 | critical | Public frontend fabricates municipal evidence | static bridge deleted; Pages returns bounded 503; widget disabled; 33/33 eval | preserve artifact/current branch and implement gateway before enablement |
| R-PUBLIC-02 | critical | Browser receives integration/tenant credential | no credential forwarding; explicit gateway/BFF boundary; legacy chat production-disabled | implement server-bound public gateway and red-team it |
| R-PUBLIC-03 | critical | Gateway exposes foreign tenant or private corpus | route remains 404; public tenant/corpus contract specified | forced public binding, RLS/SQL gates and non-enumerating errors |
| R-CORPUS-01 | critical | Incomplete/unlicensed corpus is treated as authority | 17/4/1/0 inventory truth and explicit no-ingestion statements | approve rights, storage, scan and reviewers; ingest exact bytes |
| R-AUTH-01 | critical | Service credentials are reused as human sessions | browser journeys blocked; ADR 063 and Feature 071 boundary | approve IdP/OIDC/PKCE/BFF/session and secure-cookie design |
| R-CLOUD-01 | critical | Cloud creation causes uncontrolled cost or exposure | GCP architecture only; zero resources/billable actions; apply prohibited | project/budget/region approval, guarded Terraform, quotas and budgets |
| R-OPS-01 | critical | Feature CI is mistaken for production readiness | release/current-state explicitly deny merge/deploy/observation | immutable staging/deployment/observation receipts required |
| R-RETRIEVAL-01 | high | Synthetic gates overstate real retrieval quality | no real-corpus credit; semantic fail-closed tests | judged corpus, human citation review, latency/load/cost SLOs |
| R-EVIDENCE-01 | high | Comparative or stale evidence is promoted | conservative classifications, conflicts and gaps | human authority/vigencia/jurisdiction/applicability workflow |
| R-E2E-01 | high | Browser E2E hides lower-layer defects | explicit API-versus-browser ownership and blocked journeys | execute staging runner first; keep browser suite bounded |
| R-CONSUMER-01 | high | Provider stubs are presented as external interoperability | contract kits say provider-side only | run suites in OS Electoral and Content Agency |
| R-A11Y-01 | high | Glassmorphism or motion makes UI inaccessible | tested contrast tokens, opaque panels, focus and reduced motion | browser/screen-reader/human WCAG review |
| R-STORAGE-01 | high | Missing object/scanner controls allow unsafe ingestion | artifact acceptance/scan contracts and no production claim | deploy immutable storage, current scanner and definition monitoring |
| R-RESTORE-01 | high | Logical DB restore is mistaken for complete DR | disposable DB drill explicitly limited | object, PITR, KMS, RPO/RTO, HA and human exercise |
| R-PRIVACY-01 | high | Personal/internal data enters public/local browser storage | Pages public-only policy and explicit local-storage warnings | approved data map, retention/deletion/legal hold and DSAR operations |
| R-OCR-01 | high | New OCR custom code/model leaks data or hallucinates structure | Unlimited-OCR evaluation-only; no download/dependency | isolated pinned benchmark, sandbox, non-sensitive samples and review |
| R-SEO-01 | medium | SEO tooling expands attack and operations surface prematurely | OpenSEO deferred outside core runtime | assess only after public domain/content policy and threat review |
| R-DOC-01 | medium | Historical demo documents mislead operators | current docs updated; hard evals protect current truth | continue marking historical specs as superseded where encountered |

## Current stop conditions

Production declaration is prohibited while any of these remain true:

- public gateway absent;
- zero authorized real documents credited as ingested;
- browser authentication/session architecture absent;
- staging runner/browser E2E not executed;
- GCP project/infrastructure/observability/load/recovery/privacy evidence absent;
- external consumer suites absent;
- reviewed PR, protected merge, deployment and observation absent.
