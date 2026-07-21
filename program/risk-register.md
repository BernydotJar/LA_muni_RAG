# Program Risk Register

Updated: 2026-07-21T23:20:48Z

| ID | Risk | Severity | Current control | Residual action |
|---|---|---:|---|---|
| PRG-RISK-001 | Source discovery is mistaken for official/current authority | critical | closed source request, unreviewed defaults, insert grants exclude authority, comparative warning, EVAL-SOURCE-API | human validation and applicability workflow |
| PRG-RISK-002 | URL/hash metadata is mistaken for durable acquisition | critical | catalog states remain not_acquired/not_ingested/not_indexed; zero ingested statement | authorized object storage, exact acquisition, scan and manifest reconciliation |
| PRG-RISK-003 | Cross-tenant catalog/case/provider metadata leaks | critical | credential tenant binding, transaction-local context, composite FKs, forced RLS, non-owner A/B gates | full production topology and access review |
| PRG-RISK-004 | Schema-valid replay changes authority or artifact state | critical | SHA-256, schema, identity, aggregate lookup, canonical reconstruction, committed cleanup | production DB integrity/monitoring |
| PRG-RISK-005 | Private object, scanner, lease or workflow internals leak | critical | explicit SQL projections, column grants, closed responses and adversarial tests | audit all future endpoints and operator UI |
| PRG-RISK-006 | Signed URL or embedded credential persists | critical | HTTP URL inspection and PostgreSQL constraints | storage adapter and secret-scanner operation |
| PRG-RISK-007 | Green synthetic retrieval is mistaken for corpus quality | critical | explicit zero real retrieval validation and scope-specific eval states | real-corpus judged evaluation and human citation review |
| PRG-RISK-008 | Case completion is treated as legal/municipal approval | critical | closed case schema, review separation and explicit limitations | authenticated UI wording and legal/domain review |
| PRG-RISK-009 | Public Academy is mistaken for authenticated SaaS | high | read-only labels, no browser integration credentials or case facts | approved OIDC/BFF/session and role shell |
| PRG-RISK-010 | Operational text lacks lawful retention/deletion process | high | audit minimization and bounded fields | approved purpose, retention, legal hold, deletion and DSAR operations |
| PRG-RISK-011 | Disposable DB restore is mistaken for production DR | critical | explicit object/PITR/RPO-RTO non-proofs | coordinated staging drill, key recovery and human sign-off |
| PRG-RISK-012 | No production telemetry, load or HA evidence | critical | CI, runbooks and disposable DB smokes only | staging, metrics/traces/SLOs/alerts/load/HA |
| PRG-RISK-013 | Missing search/bundle routes preserve manual gaps | high | underlying retrieval and ProcedureQuery output exist | implement dedicated Search and EvidenceBundle APIs |
| PRG-RISK-014 | External consumers drift from provider contracts | high | closed schemas/OpenAPI/provider tests | cross-repository consumer suites and staging |
| PRG-RISK-015 | Cumulative feature branches remain outside protected main | high | exact remote refs and CI receipts | human-reviewed PRs and protected merge |
| PRG-RISK-016 | Dependency advisory enters the release | high | lockfile now resolves fast-uri 3.1.4; all/prod audits zero | continue SBOM/license/signature review and CI audit gate |
| PRG-RISK-017 | Rate-limit denial audit collision causes 500 | high | one audit per bucket, repeated denials remain 429, regression coverage | production concurrency/load observation |
| PRG-RISK-018 | Catalog API CI has not completed at this checkpoint | medium | local/detached/PG evidence and exact remote SHA | verify run 29876782983 before promotion |

Feature 067 has no open critical/high code finding after producer, red-team,
fixer and independent verification. Global product and external/human risks remain
open and prevent a production-ready claim.
