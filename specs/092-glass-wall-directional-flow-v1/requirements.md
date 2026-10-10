# Feature 092 - Directional, evidence-honest Glass Wall
Mode: SHIP. Approved scope: user's acceptance of the preceding directional-map/UI proposal, 2026-09-20.

## Acceptance
- Readable directional arrows at node boundaries, not center-to-center lines under cards.
- Ordered stages: Entrada, Busqueda, Reunion, Evidencia, Respuesta. Branching methods converge before visible citations. No invented per-citation route, ranking score, audit or semantic execution.
- Solid arrows mean completed/reported stages; dashed routes mean pending/not executed; warning/error styles and text are distinct. Never activate vector paths from citation counts.
- idle, loading, found, empty, partial failure, malformed response and transport failure have truthful Spanish labels. Loading clears stale results; a late request cannot overwrite a newer query.
- Public query contract and static-first bridge preserved. No API/backend, corpus, auth, cloud or billing changes.
- Internals remain available as a separate explanatory disclosure, never connected to a claimed executed path. A static response explicitly says local public-copy search, not server health/audit.
- Cards render untrusted query, labels and excerpts as text; external links require HTTPS without credentials and rel=noopener noreferrer.
- Keyboard navigation, visible labels/focus, live status, reduced motion, forced colors and 320/390/768/1440 responsive layouts. No tiny scaled mobile map, hidden arrows or horizontal page overflow.
- Unit EVAL, behavioral browser tests, real frozen corpus, regression/typecheck/build, graph replay, secret scan, diff check and exact-head CI before completion. Deployment is distinct from implementation and recorded separately.

## Boundaries
Read: repo instructions, Graph Harness pinned runtime, existing public query/UI/tests, user-provided RAG Juridico arquitectura.md.
Touch: public/glass-wall.html, public/glass-wall-flow.js, public/glass-wall-view.js, public/glass-wall.css, relevant tests, scripts/verify-pages-online.mjs, specs/092-*/, docs/reviews/092-*, docs/traceability/092-*, program/*, package.json only for EVAL script.
Do not touch: untracked docs/architecture/agentic-engineering-architecture-audit.md; framework source; source inventory or corpus; DB; cloud; identity; other products.
