# Design — GitHub Pages Static Deploy

## Deployment Model

GitHub Pages is used only for the static public frontend:

- `index.html`
- `glass-wall.html`
- `widget.js`
- static assets under `public/assets`

The backend RAG API remains out of scope for Pages because GitHub Pages cannot run the Node server, PostgreSQL, embeddings, or `/api/chat`.

## Build Strategy

A small Node build script copies `public/` into `dist-pages/` and applies static-site adjustments:

1. Create a clean output directory.
2. Copy all public assets.
3. Add `.nojekyll`.
4. Patch root-relative static references for project-page hosting.

This avoids changing the source `public/` files while making the Pages artifact work under:

```text
https://BernydotJar.github.io/LA_muni_RAG/
```

## Runtime Boundary

The widget remains capable of calling a separately deployed API when embedded with `data-api-url`. On GitHub Pages, without an API URL, the chat surface should be treated as frontend presentation only.

## Safety

- No environment variables are exposed.
- No API secrets are shipped.
- No database connection string is shipped.
- The Pages artifact contains static files only.

## Future Work

A later feature can add a public API deployment target and configure the Pages widget to call it using `data-api-url` or a build-time injected API base URL.
