# Production Readiness Gap Matrix

Updated: 2026-07-21T23:20:48Z

A green slice does not make a workstream or the product production-ready.

## Workstreams

| Workstream | Current evidence | Remaining production gap | State |
|---|---|---|---|
| WS-01 Baseline and Architecture | product boundaries, ownership, specs, program ledger | protected-main integration and current architecture review | partial |
| WS-02 Corpus and Sources | 17 governed records; 4 verified; Source API unreviewed registration | durable exact corpus, scan, freshness/supersession and human validation | partial |
| WS-03 Artifact and Ingestion | exact acceptance, jobs/leases/fencing/retry, vector generations, safe job list | production object/scanner/dispatcher/quotas/cancellation/DLQ/load/HA | partial |
| WS-04 Retrieval and Evidence | keyword/phrase/vector foundations and existing ProcedureQuery EvidenceBundle | dedicated search/bundle routes, complete filters and real-corpus quality | partial |
| WS-05 Procedure Knowledge | conservative workflow/assessment, conflicts, lifecycle review/approval | real-corpus applicability and human-approved Antigua procedures | partial |
| WS-06 Procedure Cases | server-side tenant cases, documentary review separation, append-only audit | authenticated case UI, privacy, production load/recovery | partial |
| WS-07 Identity/Tenancy/RBAC | ten roles, credential tenant binding, forced RLS, non-owner gates | human OIDC/session/provisioning/revocation/access review | partial |
| WS-08 APIs and Contracts | 27 schemas/examples; OpenAPI; source/document/job/procedure catalogs plus providers | search and dedicated EvidenceBundle; external consumers | partial |
| WS-09 Frontend/A11y | public evidence-first Academy and static accessibility gate | authenticated product, browser/screen-reader/human WCAG evidence | partial |
| WS-10 Platform/Ops | CI, non-root image, runbooks and disposable DB restore | Terraform, secrets, observability, staging, load/HA, object/PITR recovery | partial |
| WS-11 Evals/Docs | 747/749 detached; all required named evals plus Source/Document API; real DB gates | real corpus, browsers, consumers, load/HA and production observation | partial |
| WS-12 Legal/Human Review | authority/jurisdiction/version fields and no unsupported legal status | applicability, privacy/retention and official-procedure sign-offs | partial |

## Minimum API catalog

| Endpoint | State | Evidence / remaining gap |
|---|---|---|
| `GET /api/v1/sources` | verified_with_limits | auth/RBAC/tenant/RLS/pagination/HTTP+PG pass; human validation and production remain |
| `POST /api/v1/sources` | verified_with_limits | exact replay and authority non-promotion pass; acquisition/validation remain separate |
| `GET /api/v1/documents` | verified_with_limits | safe version/artifact/job projection; real objects/ingestion remain absent |
| `POST /api/v1/documents` | verified_with_limits | tenant source + SHA; server-owned draft/queued states; no upload or scan |
| `GET /api/v1/ingestion-jobs` | verified_with_limits | safe status list including retry_wait; production dispatcher/monitoring absent |
| `POST /api/v1/search` | missing | dedicated tenant search contract/runtime gate required |
| `POST /api/v1/evidence-bundles` | missing_dedicated_route | output exists through ProcedureQuery; dedicated route/replay/runtime proof required |
| `GET /api/v1/procedures` | verified_with_limits | safe latest/approved summaries; authenticated UI and production absent |
| `POST /api/v1/procedure-queries` | verified_with_limits | bundle/workflow/assessment provider passes; real corpus and consumer remain |
| workflow lifecycle routes | verified_with_limits | RLS/review/approval/replay pass; human UI/production remain |
| procedure case routes | verified_with_limits | DB/API/audit pass; UI/privacy/load/deployment remain |
| `POST /api/v1/claim-packs` | verified_with_limits | provider passes; Content Agency consumer absent |
| `POST /api/v1/evidence-gap-requests` | verified_with_limits | immutable intake passes; resolution/retention/consumer absent |

## Golden water path

| Requirement | State | Remaining closure |
|---|---|---|
| 47 research categories | verified synthetic structure | validate ordering/applicability with real sources and human review |
| per-step evidence model | verified contract | populate only from real citable corpus |
| missing evidence | verified | preserve through search, UI and cases |
| Antigua-first authority | incomplete | acquire and review Antigua/national artifacts |
| comparative warning | verified | corroborate every material comparative claim |
| workflow lifecycle | verified_with_limits | human UI and real evidence review |
| case tracking | verified_with_limits | authenticated UI and privacy operations |
| real retrieval/citations | missing | judged corpus, pages, valid/invalid citations and refusal thresholds |

## Current quality baseline

```text
branch: feature/catalog-api-v1
functional SHA: 9da29720c23d64bc73bdb24e92e67707834f4f84
tests: 749 total / 747 pass / 0 fail / 2 skips
contracts: 27 schemas / 27 examples / OpenAPI 3.1.1
source inventory: 17 valid / 4 verified / 1 acquisition metadata / 0 ingested
PostgreSQL: 15.18 / pgvector 0.8.5 / non-owner / forced RLS
npm audits: 0 vulnerabilities
remote CI: 29876782983 in progress
merged: false
deployed: false
```
