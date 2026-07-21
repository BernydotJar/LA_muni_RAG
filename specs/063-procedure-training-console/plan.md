# Plan — Academia de Procedimientos

Status: implemented and verified locally; detached/publication/remote CI pending

## Architecture

Use repository-native static HTML/CSS/JavaScript so the preview works both from
the Node static server and GitHub Pages. The page loads a versioned curriculum
JSON and attempts the existing `/api/procedure` demo/development route. API data
may enrich evidence, but the curriculum and explicit missing-evidence state do
not depend on the API being available.

## Files

```text
public/procedure-training.html
public/procedure-training.css
public/procedure-training.js
public/data/water-training-map.json
src/__tests__/procedure-training-console.test.ts
src/__tests__/eval-accessibility-001.test.ts
```

## Interaction model

- left: product navigation and SaaS boundary;
- center-left: ordered lesson rail and local progress;
- center: lesson content and learning check;
- right: evidence/gaps panel;
- lower section: complete 47-category research map.

## Security and privacy

- no browser credential or API token;
- `credentials: "omit"` and `redirect: "error"` for fetches;
- no `innerHTML` or inline event handlers;
- LocalStorage contains module ID and completed lesson IDs only;
- source links must be HTTP(S) and are opened with `noopener noreferrer`;
- public/demo status and non-certification language are always visible.

## Accessibility

- semantic landmarks, labelled navigation and form controls;
- skip link and visible focus;
- status updates through a polite live region;
- arrow/home/end lesson navigation;
- 44px targets and responsive reflow;
- reduced motion and forced-colors support;
- automated contrast checks for core tokens;
- human assistive-technology review remains a release gate.
