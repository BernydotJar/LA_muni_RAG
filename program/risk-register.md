# LA Muni RAG — Program Risk Register

Updated: 2026-07-22T16:53:05Z

| ID | Risk | Current control/evidence | Residual state |
|---|---|---|---|
| R-CORPUS-01 | Synthetic fixtures are mistaken for real corpus readiness | Current-state reports 0 ingested; Feature 070 marks all fixtures synthetic/non-authoritative | critical_open |
| R-AUTHORITY-01 | Retrieval output is mistaken for legal validity/applicability | Conservative evidence labels, comparison warnings, human-review limitations | high_open_until_human_review |
| R-TENANT-01 | Cross-tenant or private data leaks | Forced RLS, non-owner gates, exact 403 journey and deterministic two-tenant plan | controlled_locally; deployed staging/production drift open |
| R-STAGING-01 | Architecture plan is presented as a deployed environment | Summary flags, docs, eval, and release state explicitly deny deployment | high_open until runner and independent service receipts exist |
| R-STAGING-02 | Test reset leaves state or credentials behind | Closed reset order/postconditions, mutable-resource coverage, mandatory destruction | high_open until actual runner proves cleanup |
| R-SECRET-01 | Production credentials/data enter tests | Runtime-only references, secret-pattern and endpoint guards, no-production flags | critical_open until platform secret injection/attestation exists |
| R-IDP-01 | Service Bearer credentials are reused in browser code | Browser journeys blocked; ADR forbids repurposing credentials | critical_open until human IdP/BFF/session exists |
| R-E2E-01 | Browser tests duplicate API concerns and become brittle | Exact API/browser concern sets and layer violations fail closed | controlled_architecture; future UI discipline required |
| R-E2E-02 | Browser suite runs before deterministic data/identity | Twelve journeys remain blocked by exact prerequisites | high_open until prerequisites are implemented |
| R-RBAC-01 | Test roles drift from runtime permissions | Exact role/permission import plus principal and journey coverage | controlled_locally; human provisioning/access review open |
| R-CONSUMER-01 | Provider changes break external consumers | Feature 069 exact manifests and CI | high_open until consumer repositories run suites |
| R-CONSUMER-02 | Contract stubs are presented as interoperability | Feature 070 enforces provider-contract-only status | high_open until independent evidence exists |
| R-OPS-01 | Local gates are presented as production operations | No staging/load/HA/SLO/deployment claim | critical_open |
| R-PRIVACY-01 | Retention/deletion/legal-hold obligations are undefined | Documentation only | critical_open |
| R-RELEASE-01 | Published branch is mistaken for merged/deployed product | Branch/SHA/CI/PR/merge/deploy tracked separately | high_open |
