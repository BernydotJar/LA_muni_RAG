# Requirements — 027-glass-wall-vector-runtime-insights

## Mode

SHIP

## Goal

Enhance the Glass Wall technical view with richer vector-runtime explanation and more premium CSS motion while preserving safe endpoint boundaries and existing RAG behavior.

## User Problem

The Glass Wall already shows the retrieval route, evidence status, and answer state. However, the vector section is visually attractive but too terse: `búsqueda vectorial`, `embedding`, and `almacén vectorial` do not explain what is happening or why the route is degraded, partial, unknown, or active.

## Scope

### In scope

- Add safe vector/embedding/store diagnostics to `public/glass-wall.html`.
- Add a dedicated side panel for vector runtime details.
- Enrich graph nodes for `Búsqueda vectorial`, `Embedding`, and `Almacén vectorial`.
- Add CSS-only animation for active routes, scanlines, vector pulses, and node glow.
- Preserve Spanish UI.
- Preserve endpoint allowlist.
- Preserve safety contract.
- Add/update regression tests.
- Update harness tracking.

### Out of scope

- Backend API changes.
- Retrieval ranking changes.
- Embedding provider changes.
- Database schema, migrations, secrets, environment variables, package files.
- Exposing DB URLs, credentials, prompts, private model messages, or hidden reasoning.

## Functional Requirements

- The Glass Wall must still call only approved endpoints:
  - `/health`
  - `/api/evidence`
  - `/api/answer`
- Vector details must be derived only from sanitized `/health`, `/api/evidence`, and `/api/answer` responses.
- The vector side panel must explain:
  - vector runtime state;
  - hybrid mode relationship;
  - query embedding state;
  - vector store state;
  - degraded reasons when available.
- The graph nodes must show more meaningful values than `parcial`, `store`, or `unknown` when sanitized runtime data exists.
- Motion must be CSS-only and must respect `prefers-reduced-motion`.

## Acceptance Criteria

- Glass Wall includes a `Vector / Embedding` side panel.
- Graph includes visible vector pulse/scan animations.
- Active/warn edges animate without new dependencies.
- Vector, embedding, and store nodes include explanatory values.
- Approved endpoint allowlist remains unchanged.
- Safety contract remains unchanged in substance.
- Tests protect the new vector insight panel and motion guards.

## Verification Commands

Run locally before closing:

```sh
npm run typecheck
npm run build
npm run test
```
