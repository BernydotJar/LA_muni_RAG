# Domain Pack UI Labels And Routing

Feature: `044-domain-pack-ui-labels-and-routing`  
Status: server-controlled metadata; public production gateway pending

## Purpose

The procedure workflow page adapts visible copy to the active server-side domain
pack. `municipal-antigua` remains the default while other deployments may use
neutral domain language.

## Legacy public endpoint

```http
GET /api/domain-pack
```

This legacy endpoint is disabled when `NODE_ENV=production`. A future public
gateway may expose a bounded metadata projection, but it must not reveal
environment variables, secrets, database URLs, tokens or dependency internals.

## Frontend behavior

`public/procedure-workflow.html` requests `/api/domain-pack`. If the request
fails, it keeps conservative Antigua-first labels and does not claim that a
server-selected pack was loaded.

## GitHub Pages behavior

`public/pages-api-bridge.js` forwards the route only when a reviewed
`PAGES_API_URL` is configured. Otherwise it returns HTTP 503. It does not return
static domain metadata.

## Governance

The public UI cannot select a domain pack. Runtime configuration and any future
public metadata projection remain server-controlled.
