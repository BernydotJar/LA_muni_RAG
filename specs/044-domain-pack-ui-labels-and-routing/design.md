# Design — Domain Pack UI Labels And Routing

## Endpoint

`GET /api/domain-pack` returns:

```json
{
  "id": "municipal-antigua",
  "name": "Municipal Antigua",
  "language": "es",
  "branding": {},
  "workflowTypes": [],
  "exampleQueries": [],
  "defaultQuery": "¿Qué hay que hacer para construir un estadio municipal?"
}
```

This is intentionally a public, safe summary. It is not a runtime config dump.

## Frontend

`procedure-workflow.html` fetches `/api/domain-pack` on load. If the request fails, it keeps the Antigua-first fallback copy.

For `municipal-antigua`, the page keeps Spanish municipal language and Antigua validation copy.

For other packs, the page switches to neutral English labels:

- evidence-first workflow framing;
- pack-specific assistant/product labels;
- default query from `exampleQueries`;
- neutral validation language.

## GitHub Pages

`pages-demo-api.js` intercepts `/api/domain-pack` in demo mode and proxies it in configured API mode using the same safe GET behavior as `/api/procedure`.

## Safety

The feature does not add tenant switching. The active domain still comes from server-side `DOMAIN_PACK`.
