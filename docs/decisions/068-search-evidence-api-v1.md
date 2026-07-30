# ADR 068 — Dedicated Search and EvidenceBundle API v1

Date: 2026-07-21
Status: accepted for the feature branch; not merged or deployed

## Context

The repository already contained tenant-scoped keyword/phrase retrieval, a hardened tenant vector repository, query-embedding support, and an EvidenceBundle mapper used by the procedure-query integration. It did not expose the product-minimum dedicated routes `POST /api/v1/search` and `POST /api/v1/evidence-bundles`.

Reusing the legacy global search functions would bypass transaction-local tenancy and accepted-artifact controls. Reusing the procedure-query endpoint as the dedicated search API would also conflate retrieval with workflow compilation and preserve silent lexical degradation in deep-dive mode.

## Decision

1. Add dedicated closed request/response contracts and OpenAPI operations for Search and EvidenceBundle.
2. Execute all retrieval through a repository closed over the authenticated tenant transaction.
3. Require source acquired/ingested/indexed state, active public documents, processed extraction, exact accepted clean artifact state, processed ingestion job, citation identity, public URL, and digest provenance.
4. Derive authority, temporal, and evidence-use labels from persisted server-owned state. The client may filter those derived labels but may not set them.
5. Treat semantic and hybrid retrieval as explicit capabilities. Missing, timed-out or failing capability returns `503`; hybrid never claims semantic execution after a lexical-only fallback, and provider calls execute outside PostgreSQL transactions.
6. Deduplicate by document-version/section citation identity and bound the repository fan-out and final response.
7. Use reciprocal-rank fusion for hybrid ranking without interpreting retrieval score as legal authority.
8. Build the dedicated EvidenceBundle from the same classified candidates, promoting only supported exact excerpts to ordinary claims.
9. Preserve comparative and validation-required material as citations and gaps; never promote it to supported claims.
10. Preserve explicit version conflicts as review-required positions and contradictions rather than selecting a version automatically.
11. Add digest-only exact replay state, bounded rate state, minimized unauthenticated failure aggregation, forced RLS, public revocation, and column-level runtime grants.
12. Verify with named evals, fresh PostgreSQL/pgvector migrations, a non-owner RLS gate, and a compiled HTTP smoke.

## Consequences

- Search behavior is explicit and reproducible against an `as_of_date`.
- A semantic outage is visible instead of being hidden as keyword output.
- Retrieval output remains useful without claiming corpus completeness, legal applicability, or official procedure.
- EvidenceBundle replay performs semantic relationship checks in addition to schema and hash validation.
- The runtime role can test accepted-artifact predicates without reading private object or scanner coordinates.
- More joins are required per query, and production performance has not yet been established. Appropriate indexes, explain plans, load tests, cache policy, and SLOs remain open.
- Real embedding provider connectivity, quality, costs, and model lifecycle are not proven by the deterministic gate provider.
- This decision does not authorize merge, deployment, production infrastructure, or OS Electoral/Content Agency implementation.
