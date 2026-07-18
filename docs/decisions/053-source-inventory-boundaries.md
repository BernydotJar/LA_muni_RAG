# Decision Record — Feature 053 Source Inventory Boundaries

## Status

Accepted for review.

## Decision 1 — Separate declarative and operational manifests

`.rag/source-inventory.json` records documentary discovery, jurisdiction, authority and lifecycle claims. The existing corpus manifest records indexing outcomes. Neither file substitutes for the other.

Rationale: a URL, title or queued source is not proof of acquisition or ingestion.

## Decision 2 — Require evidence for ingestion

A source may be marked `ingested` only when it has:

- acquired artifact path and SHA-256;
- successful extraction with positive section count;
- successful indexing with positive chunk count;
- matching document key, version and hash in the operational corpus manifest.

## Decision 3 — Antigua-first authority

Only primary, non-external municipal authority counts as Antigua-specific evidence. National law remains applicable but does not prove internal municipal implementation.

## Decision 4 — External municipalities remain comparative

A source naming another municipality cannot become primary through title or document-type heuristics. Mixco is official for Mixco and comparative for Antigua.

## Decision 5 — Preserve missing evidence

Priority documents without a confirmed official URL remain `missing_source`. The inventory must not create fictitious URLs, versions, hashes or ingestion claims.

## Decision 6 — Map inventory authority to domain-pack IDs

Declarative inventory classes are translated to valid `municipal-antigua` domain authority IDs before ingestion metadata is built. The original inventory class remains preserved in tags for auditability.

## Consequences

- Source registration is auditable but conservative.
- Acquisition and ingestion can be automated later without weakening authority boundaries.
- Existing corpus and retrieval behavior remain compatible.
