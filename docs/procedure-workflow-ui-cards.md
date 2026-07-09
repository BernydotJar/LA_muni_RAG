# Procedure Workflow UI Cards

## Purpose

This page renders Procedure Workflow Advisor responses as a municipal workflow interface instead of a chat paragraph.

Route:

```text
/procedure-workflow.html
```

API used by the page:

```text
GET /api/procedure?q=<query>&mode=<mode>&limit=<limit>
```

## What the UI shows

- workflow summary;
- jurisdiction and confidence;
- one card per procedure step;
- required documents;
- output documents;
- step citations/evidence labels;
- notes and validation-required text;
- gaps and missing documents;
- final human validation warning;
- copy-checklist button.

## Safety posture

The UI does not hide low confidence, gaps, or validation warnings. If the API marks external municipal references, the UI shows a warning that the flow must be validated against Antigua Guatemala official documents and national law.

## GitHub Pages demo mode

`public/pages-demo-api.js` now supports `/api/procedure` in static demo mode. This keeps the page usable on GitHub Pages without deploying the Node backend. Demo citations keep `sourceUrl: null`.

## Current limitation

The UI is a dedicated page. It does not yet replace or deeply integrate with the embeddable chat widget.
