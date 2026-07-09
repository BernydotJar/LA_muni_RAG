# Design — Procedure Workflow UI Cards

## Product Intent

Feature 036 made procedure workflows available as structured JSON. Feature 037 adds a dedicated public UI page that renders those workflows as cards for municipal users.

The page is intentionally separate from the chat widget in this MVP. This avoids destabilizing the existing widget contract and lets the team validate the procedure interaction pattern before integrating it into the chat surface.

## Page

```text
public/procedure-workflow.html
```

## Data Flow

```text
Form query
  ↓
GET /api/procedure?q=<query>&mode=<mode>&limit=<limit>
  ↓
ProcedureWorkflow JSON
  ↓
Summary panel + step cards + gap cards + citations + validation warning
```

## GitHub Pages Support

The existing `public/pages-demo-api.js` bridge is extended to recognize `/api/procedure` requests. In static demo mode, it returns a conservative procedure workflow demo response with:

- `public_works` workflow type;
- Antigua-first copy;
- step cards for classification, planning/budget, expediente técnico, contracting, execution, reception/closure;
- gaps;
- validation warning;
- citations with `sourceUrl: null`.

## Rendering Rules

- Escape all dynamic text before inserting into HTML.
- Render missing arrays as empty states.
- Always show gaps when present.
- Always show validation warning.
- Keep low confidence visible.
- Show external-reference warning when `metadata.hasExternalReference` is true.
- Copy checklist must copy step titles, required documents, gaps, and validation warning.

## Test Strategy

Add static tests against the page and Pages bridge:

- page exists and calls `/api/procedure`;
- page has workflow cards, gap cards, citations, validation warning, and copy checklist affordance;
- page uses escaping helpers before rendering dynamic content;
- Pages bridge recognizes `/api/procedure` and returns demo workflow JSON;
- existing procedure backend remains untouched.
