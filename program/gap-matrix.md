# LA Muni RAG — Gap Matrix

Updated: 2026-07-22T20:47:22Z

| Workstream | Verified now | Remaining production gap | State |
|---|---|---|---|
| Product/public UX | Concise modular shell; direct Assistant/Glass Wall; fail-closed Pages; contrast/focus/responsive gates | real corpus, gateway enablement/deployment, human accessibility, authenticated application surfaces | partial |
| Public query boundary | Closed `/api/public/v1/query`; server-bound tenant; exact CORS; HMAC/global rate; forced RLS; minimized audit; 23/23 and compiled PostgreSQL smoke | authorized corpus, edge/WAF, load/SLO, staging, deployment and Pages binding | verified with limitations |
| Sources/corpus | 17 inventory records, 4 verified, 1 acquisition metadata | source rights, durable bytes, scanner, immutable manifests, human authority review | blocked external |
| Ingestion | Artifact, job, lease/fencing, vector and HTTP foundations | production object store/scanner/dispatcher, real document ingestion, monitoring and load | partial |
| Retrieval/evidence | Keyword/phrase/semantic/hybrid and conservative EvidenceBundle APIs | judged real-corpus relevance, provider SLO/cost/load, human citation/vigencia/applicability review | partial |
| Procedures/workflows | ProcedureQuery, lifecycle, assessment, EvidenceGap and training foundations | real evidence, human approvals, research resolution workflow and institutional operation | partial |
| Cases | Approved-workflow case lifecycle, document-version validation, RLS and audit | authenticated UI, retention/privacy policy, load, recovery and deployment | partial |
| Identity/RBAC | Ten server roles, tenant-bound credentials, forced RLS | browser identity/session, IdP/BFF, provisioning, recovery and access review | partial |
| Integrations | Provider-side OS Electoral and Content Agency kits | consumer repository execution and cross-store retry/revocation/supersession | partial |
| Staging/E2E | Executable plan: 20 API/system and 12 blocked browser journeys | runner execution, deployed services, identity/UI and browser execution | architecture verified |
| Cloud/IaC | GCP Cloud Run/Cloud SQL/Storage target and cost constraints documented | project, billing, region, guarded Terraform, workload identity, secrets and staging | architecture only |
| Security/privacy | Fail-closed Pages, strict public gateway, minimized audit and zero dependency vulnerabilities | penetration test, edge controls, retention/deletion/legal hold/DSAR operations | partial |
| Observability/reliability | Sanitized audit foundations and disposable restore drill | production metrics/traces/SLOs/alerts, load/HA, PITR, object/KMS recovery | partial |
| Release | Exact feature SHAs and successful CI receipts | reviewed PR, protected merge, deployment rehearsal, rollout/rollback and observation | incomplete |

## Non-negotiable truths

- Zero documents are credited as ingested against a real, reviewed corpus.
- Gateway is implemented but disabled and undeployed.
- Browser authentication/session architecture is not implemented.
- No staging runner has executed the complete lifecycle.
- GCP selection created no resource and incurred no billable action.
- Passing Feature 072 is not production readiness.
