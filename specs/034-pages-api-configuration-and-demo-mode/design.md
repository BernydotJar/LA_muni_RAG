# Design — Pages API Configuration and Demo Mode

## Problem

GitHub Pages can publish the frontend, but it cannot run the Node API, PostgreSQL, embeddings, or `/api/chat`. Without a bridge, the widget opens but fails when a user submits a query.

## Design

Add `public/pages-demo-api.js`, a small static bridge loaded before `widget.js` in the Pages artifact.

The bridge intercepts only requests whose path ends with `/api/chat`.

## Modes

### Auto demo mode

On `*.github.io`, if no API URL is configured, the bridge returns static demo responses with municipal-style citations.

### API proxy mode

If `?apiUrl=https://api.example.com` or `data-api-url="https://api.example.com"` is present, the bridge forwards `/api/chat` requests to that deployed API.

### Disabled mode

If `data-demo-mode="false"` is set, the bridge does nothing.

## Safety

- The bridge does not intercept unrelated network calls.
- Demo citations keep `sourceUrl: null` to avoid pretending that a PDF/source link exists.
- The bridge is only injected into the Pages artifact, not required by backend runtime.
- No secret, token, database URL, or internal storage path is shipped.

## User Experience

The Pages site remains demoable: clicking the widget and asking questions returns evidence-style responses. When a real API exists, the same static frontend can route to it without changing widget code.
