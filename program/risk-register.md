# LA Muni RAG — Program Risk Register

Updated: 2026-07-22T01:05:41Z

| ID | Risk | Current control/evidence | Residual state |
|---|---|---|---|
| R-CORPUS-01 | Fixtures are mistaken for real corpus readiness | Explicit 0-ingested state and test-only labels | critical_open |
| R-AUTHORITY-01 | Retrieval is mistaken for legal validity/applicability | Conservative authority/evidence labels and human-review limits | high_open_until_human_review |
| R-TENANT-01 | Cross-tenant/private metadata leaks | Forced RLS, non-owner grants and adversarial smokes | controlled_locally; staging drift open |
| R-CONSUMER-01 | Provider changes break external consumers | Feature 069 exact manifests and verifier | high_open until consumer repositories run suites |
| R-CONSUMER-02 | Provider-side green is presented as interoperability | Manifests/docs explicitly deny that claim | high_open until cross-repository evidence |
| R-BOUNDARY-01 | Campaign/content fields enter provider contracts | Required schema/example forbidden-field guards | controlled_provider_side |
| R-E2E-01 | Browser tests become brittle and mask lower-layer defects | E2E explicitly sequenced after contracts/identity/fixtures/staging | medium_open |
| R-IDP-01 | E2E uses fake auth incompatible with production design | No browser E2E claimed before IdP/BFF decision | critical_open |
| R-SAAS-01 | Backend is presented as complete human SaaS | Current-state marks all human surfaces absent | critical_open |
| R-OPS-01 | Local gates are presented as production operations | No staging/load/HA/SLO/deployment claim | critical_open |
| R-PRIVACY-01 | Retention/deletion/legal-hold obligations are undefined | Documentation only | critical_open |
| R-RELEASE-01 | Published branch is mistaken for merged/deployed product | Branch/SHA/CI/PR/merge/deploy tracked separately | high_open |
