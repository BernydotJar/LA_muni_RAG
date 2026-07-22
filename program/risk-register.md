# LA Muni RAG — Program Risk Register

Updated: 2026-07-22T00:35:00Z

| ID | Risk | Current control/evidence | Residual state |
|---|---|---|---|
| R-CORPUS-01 | Synthetic fixtures are mistaken for real corpus readiness | Current-state and API limitations report 0 ingested; fixtures labeled test-only | critical_open |
| R-AUTHORITY-01 | Retrieval output is mistaken for legal validity/applicability | Server-derived authority/time labels, conservative claims, human-review limitations | high_open_until_human_review |
| R-TENANT-01 | Cross-tenant or private artifact data leaks | Forced RLS, explicit predicates, non-owner column grants, cross-tenant smoke | controlled_locally; staging/production drift monitoring open |
| R-SEMANTIC-01 | Semantic outage silently degrades or holds DB transactions | Fail-closed 503, provider timeout, embedding outside transactions, replay before provider | controlled_locally; provider SLO/cost/circuit-breaker open |
| R-REPLAY-01 | Hash-valid replay corrupts evidence relationships | Schema/hash/identity/claim/citation/contradiction validation and committed cleanup | controlled_locally; DB compromise/key operations open |
| R-COMPARATIVE-01 | Mixco/comparative evidence is promoted as Antigua authority | Comparative non-promotion and explicit corroboration gaps | controlled_locally; human classification review open |
| R-SAAS-01 | Backend is presented as a complete human SaaS | Current-state explicitly marks IdP/session/UI absent | critical_open |
| R-OPS-01 | Local green gates are presented as production operations | No staging/load/HA/SLO/deployment claims; disposable gates identified | critical_open |
| R-PRIVACY-01 | Retention/deletion/legal-hold obligations are undefined | Documentation only | critical_open |
| R-RELEASE-01 | Published branch is mistaken for merged/deployed product | Exact branch/SHA/CI/PR/merge/deploy fields tracked separately | high_open |
| R-CONSUMER-01 | Provider changes break external consumers | Closed schemas/OpenAPI and versioned examples | high_open until external contract suites run |
