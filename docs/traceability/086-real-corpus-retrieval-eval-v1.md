# Traceability — Feature 086 real-corpus retrieval evaluation v1

| Requirement | Implementation | Evidence |
|---|---|---|
| Exact corpus binding | Query set and evaluator verify PDM-OT document key, version, SHA and 444 chunks | `evals/real-corpus/retrieval-cases.json`, retrieval receipt |
| Judged positive cases | Eight queries with expected PDM-OT page ranges | frozen query set |
| Explicit no-answer cases | Four out-of-corpus queries and frozen lexical-vector answer threshold | frozen query set and receipt |
| Phrase retrieval | PostgreSQL Spanish `phraseto_tsquery` with exact-substring ranking boost | `evaluateRealCorpusRetrieval.ts` |
| Keyword retrieval | PostgreSQL Spanish `websearch_to_tsquery` and `ts_rank_cd` | evaluator |
| Vector retrieval | Existing `TenantPgVectorRepository.searchPublic` over local lexical hash vectors | evaluator and receipt |
| Hybrid retrieval | Existing `buildHybridRetrievalResult` | evaluator and receipt |
| Metrics | Hit@5, MRR, top-1 citation identity, unsupported-answer rate and leakage | committed receipt |
| Fail-closed safety | Final no-answer and leakage rates are zero in all four modes | verifier and named EVAL |
| Honest quality result | Phrase, keyword and hybrid gaps remain explicit; only lexical-vector mode meets all frozen targets | independent review and receipt |
| No semantic claim | Provider classified as deterministic lexical hashing; semantic/productive flags false | receipt and verifier |
| Disposable real runtime | PostgreSQL 15.18, pgvector 0.8.5, tenant context and teardown | `run-real-corpus-retrieval-eval.sh` |
| CI reproducibility | Checkout-only verifier and named EVAL over committed evidence | Backend CI |

## Acceptance summary

Real-corpus retrieval evaluation is no longer zero. It is measured and reproducible for one exact PDM-OT document and twelve frozen cases. The safety gates pass, while ranking-quality gaps remain explicit and block any broad retrieval-quality or production-readiness claim.
