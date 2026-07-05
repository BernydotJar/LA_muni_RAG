# Design — 027-glass-wall-vector-runtime-insights

## Design Intent

Make the Glass Wall feel more explanatory and alive without exposing unsafe implementation internals. The vector route should help a technical viewer understand whether semantic retrieval is active, degraded, partial, or not reported.

## Files Allowed to Change

- `public/glass-wall.html`
- `src/__tests__/glass-wall-premium-room.test.ts`
- `feature_list.json`
- `progress/current.md`
- `specs/027-glass-wall-vector-runtime-insights/*`

## Files Not to Touch

- Backend routes and APIs.
- Retrieval/evidence ranking code.
- Answer generation code.
- Database schema and migrations.
- Environment/secrets files.
- `public/index.html`.
- `public/widget.js`.

## Data Safety

The view may display only sanitized runtime data already returned by approved endpoints. It must not infer or print secrets, database URLs, provider keys, private prompts, model internals, or hidden reasoning.

## Visual Model

### Graph

- Keep the panel-node layout.
- Add a moving scan layer over the graph background.
- Animate active edges with dash flow.
- Animate warning edges more slowly.
- Add `vector-focus` treatment to vector, embedding, and vector store nodes.
- Keep reduced-motion fallback.

### Vector Insight Panel

Add a side card called `Vector / Embedding` with rows for:

- runtime vectorial;
- modo híbrido;
- embedding de consulta;
- almacén vectorial;
- observación segura.

### Node Copy

Make node values more descriptive:

- `búsqueda vectorial`: `semántica activa`, `semántica degradada`, `semántica no reportada`.
- `embedding`: `query → vector`, `embedding parcial`, `embedding pendiente`.
- `almacén vectorial`: `store consultable`, `store parcial`, `store no reportado`.

## No Backend Contract Change

No new endpoints are introduced. The approved endpoint allowlist remains exactly:

```js
const approvedEndpointPaths = ["/health", "/api/evidence", "/api/answer"];
```
