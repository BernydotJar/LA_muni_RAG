# Decision 088 — Extend the anonymous gateway instead of reopening legacy APIs

## Decision

Expose domain metadata and procedure compilation through two new public routes that reuse the existing public-query tenant context, RLS transaction boundary, evidence repository, rate-limit secret, audit sink, and exact-origin CORS policy.

The legacy authenticated `/api/domain-pack` and `/api/procedure` routes remain blocked in production.

## Retrieval

Procedure retrieval is staged:

1. the original query and high-precision domain queries;
2. only when evidence remains below the requested limit, bounded short keywords and hint tokens declared by the classified workflow type.

The fallback stops as soon as the result limit is reached. Public `hybrid` runs keyword and phrase retrieval only. It is not semantic search.

## Evidence boundary

A general PDM-OT citation may support planning or classification but does not support unrelated procurement, technical-file, execution, or closure steps. Unsupported steps remain `insufficient` and generate explicit gaps.

## Interface

The premium surface is implemented with versioned local HTML/CSS/JavaScript. External media-generation services are optional future inputs, not runtime dependencies. This avoids trial lock-in, remote scripts, extra tracking, and a visual dependency blocking the core product.
