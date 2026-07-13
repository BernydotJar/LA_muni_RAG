# Domain Pack UI Labels And Routing

Feature: `044-domain-pack-ui-labels-and-routing`  
Status: MVP

## Purpose

The procedure workflow page can now adapt its visible copy to the active server-side domain pack. This keeps `municipal-antigua` as the fallback while allowing HR, finance, sales SOP, or custom deployments to show neutral domain language.

## Public Endpoint

```http
GET /api/domain-pack
```

The endpoint returns safe UI metadata:

- pack id;
- pack name;
- language;
- branding;
- workflow type labels and descriptions;
- example queries;
- default query.

It does not expose environment variables, secrets, database URLs, tokens, or runtime dependency internals.

## Frontend Behavior

`public/procedure-workflow.html` calls `/api/domain-pack` on load.

If the call succeeds, the page updates:

- assistant/status pill;
- hero eyebrow;
- hero title;
- lead copy;
- domain note;
- default query.

If the call fails, the page keeps the Antigua-first fallback copy.

## Pages Demo/Proxy

`public/pages-demo-api.js` now handles `/api/domain-pack`.

In demo mode, it returns the municipal Antigua demo pack summary.

In proxy mode, it forwards a safe GET to the configured API base without credentials and without redirects.

## Governance

The public UI does not allow arbitrary pack switching. The active pack remains controlled by server-side `DOMAIN_PACK`.
