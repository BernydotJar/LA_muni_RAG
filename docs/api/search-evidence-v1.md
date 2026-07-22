# Search and EvidenceBundle API v1

Status: implemented and locally verified; merge, deployment, corpus quality, human legal review, production IdP, and operational SLO evidence remain pending.

## Routes

```http
POST /api/v1/search
POST /api/v1/evidence-bundles
```

Both routes authenticate a bearer credential by digest, require `evidence:query`, bind the body tenant/request/credential identities to the authenticated principal, execute within a transaction-local tenant context, rate-limit by operation, emit bounded audits, and return `ApiError v1` on failure.

`POST /api/v1/evidence-bundles` additionally requires `Idempotency-Key`. A valid replay is byte exact. A completed replay whose hash or semantic relationships are corrupt is deleted in a committed tenant transaction before the route returns `500 replay_invalid`.

## Retrieval modes

The request chooses one explicit mode:

| Mode | Execution |
|---|---|
| `keyword` | PostgreSQL Spanish full-text search with `ts_rank_cd`. |
| `phrase` | Exact case-insensitive phrase matching. |
| `semantic` | Query embedding plus provider/model/dimension-bound pgvector retrieval. |
| `hybrid` | Semantic capability is proved first, then semantic, keyword, and phrase candidates are combined by reciprocal-rank fusion after citation-identity deduplication. |

Semantic and hybrid requests are fail-closed. Missing, dimension-incompatible, or failing embedding capability returns `503 capability_unavailable`; the API never labels a lexical-only response as semantic or hybrid.

The runtime provider uses:

```env
QUERY_EMBEDDING_PROVIDER=http
QUERY_EMBEDDING_ENDPOINT=https://provider.example/v1/embeddings
QUERY_EMBEDDING_API_KEY=secret-from-workload-identity-or-secret-manager
QUERY_EMBEDDING_MODEL=reviewed-model-name
QUERY_EMBEDDING_DIMENSIONS=1536
QUERY_EMBEDDING_TIMEOUT_MS=10000
```

A configured provider is not, by itself, production evidence. Staging connectivity, secret delivery, cost controls, latency/error SLOs, model-change governance, and corpus-specific evaluation remain separate gates.

## Eligible evidence

A PostgreSQL candidate is returned only when all persisted controls agree:

- tenant identity is explicit on source, document, version, section/chunk, artifact, scan, and job;
- source acquisition is `acquired`, ingestion is `ingested`, and retrieval is `indexed`;
- document is `active` and `public`;
- version extraction is `processed`;
- the version digest equals the accepted artifact digest;
- the exact accepted scan is clean, current for the artifact generation, media-type consistent, and inside the bounded acceptance window;
- the bound ingestion job is `processed`;
- the citation label, excerpt, SHA-256 provenance, and public URL are present.

The runtime role receives column-level `SELECT` only. It cannot read object keys/namespaces/versions, scanner engine versions, lease/fencing material, pipeline configuration, or update document/source authority state.

## Authority, time, and evidence status

Authority is derived from validated server-owned source state:

- `official_target_jurisdiction`;
- `official_national`;
- `comparative`;
- `unknown`.

Temporal status is reproducible against the request `as_of_date` and stored effective/repeal dates:

- `current_by_stored_dates`;
- `future_by_stored_dates`;
- `expired_by_stored_dates`;
- `undetermined`.

A search result is `supported` only when it is validated official target/national evidence and current by stored dates. A current or undetermined comparative source is `comparative_reference`. Every other result is `validation_required`.

These are documentary classifications. They do not prove legal validity, corpus completeness, retrieval quality, supersession, institutional practice, or applicability to a concrete case.

## Dedicated EvidenceBundle behavior

The dedicated route emits the canonical `EvidenceBundle v1` schema.

- Only `supported` documentary excerpts become ordinary claims.
- Claim text is the exact bounded excerpt, not a generated legal conclusion.
- Comparative and validation-required candidates remain visible as sources/citations but are not promoted to ordinary claims.
- Mixco evidence always carries the mandatory comparative warning and an Antigua/national corroboration gap.
- Different versions of the same document/citation location with materially different excerpts produce `inferred_for_review` positions, an explicit contradiction, and a human-review gap; no version wins silently.
- No supported claim produces explicit missing evidence and a next documentary action.

## Request examples

Canonical examples:

```text
contracts/examples/v1/search-request.valid.json
contracts/examples/v1/evidence-bundle-request.valid.json
```

The schemas reject undeclared properties, including client attempts to set officiality, validation, retrieval state, score thresholds, or support status.

## Verification

```bash
npm run contracts:validate
npm run eval:search-api
npm run eval:evidence-bundle-api
npm run typecheck
npm run build
```

The guarded database path additionally applies migrations 001–015 from an empty database, runs `db/tests/search_evidence_api_runtime_gate.sql`, and executes the compiled smoke:

```bash
DATABASE_URL=postgresql://la_muni_search_runtime_test:...@127.0.0.1:5432/la_muni_rag_search_test \
  npm run smoke:search-evidence-api
```

The fixture provider and corpus in that gate are deterministic test doubles. Their passing result verifies integration mechanics and safety boundaries, not real-corpus relevance or legal correctness.
