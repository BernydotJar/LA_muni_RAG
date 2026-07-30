# Feature 067 risk register

| ID | Risk | Severity | Control | Residual limitation |
|---|---|---:|---|---|
| CAT-001 | Caller promotes a discovered source to official/current | Critical | closed request schema; server-owned defaults; insert grants exclude validation/authority columns; DB consistency checks | future human validation workflow remains separate |
| CAT-002 | Cross-tenant source, document, job or procedure metadata leaks | Critical | credential tenant binding; transaction-local context; explicit tenant predicates; `FORCE RLS`; non-owner A/B gate | production topology and access review remain open |
| CAT-003 | Schema-valid replay changes authority or artifact state | Critical | response hash, identity checks, aggregate lookup and exact canonical reconstruction; cleanup commits before error | database compromise outside runtime role remains an operational risk |
| CAT-004 | Signed URL or embedded credential is persisted | Critical | HTTP URL inspection; PostgreSQL constraints; object coordinates excluded from contracts and grants | external source URLs still require human provenance review |
| CAT-005 | Job monitoring exposes lease, fencing or provider internals | High | explicit column grants and projections; closed response schema; adversarial tests | broader operator UI and privacy policy remain open |
| CAT-006 | Document digest is mistaken for accepted or ingested evidence | High | draft/queued/not-accepted/not-started/not-indexed initial state; explicit limitation text | real object, scanner and ingestion operations remain open |
| CAT-007 | Comparative source is presented as Antigua authority | High | mandatory comparative warning; official-for-target false; DB constraint | corroboration with Antigua/national sources is still required |
| CAT-008 | Pagination becomes an enumeration or resource-exhaustion vector | High | tenant-only keyset cursor; limit 1–100; bounded cursor; no totals | distributed edge quotas and production load evidence remain open |
| CAT-009 | Audit stores documentary narrative or secrets | High | allowlisted IDs/reason codes only; no body, token, raw key or URL in audit details | retention and DSAR policy require human approval |
| CAT-010 | Green catalog tests are promoted to corpus/retrieval readiness | High | scope-specific eval status and explicit non-goals | zero real ingested/retrieval-validated documents remain |
