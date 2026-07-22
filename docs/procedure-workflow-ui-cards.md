# Procedure Workflow UI Cards

## Purpose

This page renders Procedure Workflow Advisor responses as a municipal workflow
interface instead of a chat paragraph.

Route:

```text
/procedure-workflow.html
```

Current browser request:

```text
GET /api/procedure?q=<query>&mode=<mode>&limit=<limit>
```

The legacy route is disabled in production. The page is therefore unavailable
on GitHub Pages unless a compatible reviewed public gateway is configured. The
static site does not substitute a workflow fixture.

## What the UI shows

- workflow summary;
- jurisdiction and evidence status;
- one card per procedure step;
- required and output documents;
- citations and evidence labels;
- gaps and missing documents;
- human validation warning;
- copy-checklist action.

## Safety posture

The UI does not hide low evidence, gaps, conflicts or validation warnings.
External municipal references remain comparative until corroborated against
Antigua Guatemala and applicable national sources.

## GitHub Pages behavior

`public/pages-api-bridge.js` forwards approved calls only when `PAGES_API_URL` is
configured. Without that configuration it returns HTTP 503. It contains no
static procedure, citation or domain-pack response.

## Current limitation

A production-compatible public procedure gateway has not been implemented. The
authenticated v1 ProcedureQuery contract remains server-to-server and must not
be called from a public browser with an integration credential.
