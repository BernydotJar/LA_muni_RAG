# Requirements — Domain Pack UI Labels And Routing

## Objective

Expose safe active domain-pack UI metadata and let the public workflow page adapt labels, default prompts, and copy when the server runs with non-municipal packs.

## Acceptance Criteria

- AC-01: Add `GET /api/domain-pack` returning safe active pack identity, branding, workflow types, and example queries.
- AC-02: The endpoint must not expose secrets, environment variables, database configuration, or internal retrieval dependencies.
- AC-03: `procedure-workflow.html` must load `/api/domain-pack` and adapt visible labels for non-municipal packs.
- AC-04: `municipal-antigua` remains the default visible experience when no API config exists.
- AC-05: GitHub Pages demo bridge must simulate `/api/domain-pack`.
- AC-06: Pages proxy mode must route `/api/domain-pack` safely to configured API bases.
- AC-07: Existing `/api/procedure` behavior must remain unchanged.
- AC-08: Generated `dist-pages/` is not modified or committed.

## Non-Goals

- Create separate pages per domain.
- Add auth or tenant switching.
- Allow arbitrary domain selection from public query strings.
- Build a document admin UI.
