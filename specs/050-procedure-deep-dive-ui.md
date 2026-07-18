# Feature 050 — Procedure Deep-Dive UI

## Objective

Add a progressive visual deep-dive layer to the existing Procedure Workflow page without changing the verified backend semantics or replacing the current overview experience.

## User Experience

The page exposes two explicit depths:

- `overview`: current concise workflow cards.
- `deep_dive`: full evidence inspection with dependencies, evidence status, evidence statements, supported responsibility metadata, explicit deadlines, documents, gaps, and expandable citations.

The user can move from overview to deep dive with a visible control. The selected depth is sent to `/api/procedure` as `depth=overview|deep_dive`.

## Safety Contract

- Dynamic values are written through DOM `textContent`; no untrusted HTML interpolation.
- `supported` means the backend returned direct step evidence.
- `inferred` remains visibly marked as requiring human validation.
- `insufficient` displays the backend insufficiency statement and no synthetic citation.
- Responsible roles, units, deadlines, decisions, and dependencies are rendered only when returned.
- External references remain comparative.
- The static GitHub Pages demo may demonstrate the UI contract but must not invent legal authority, approvers, responsible roles, or deadlines.

## Implementation Boundaries

- Add `public/procedure-deep-dive.js` as an isolated progressive-enhancement layer.
- Load it through the existing `procedure-feedback.js` script to avoid rewriting the monolithic workflow HTML.
- Preserve the existing `procedure-workflow:rendered` event and feedback loop.
- Add focused static tests and Pages artifact verification.
- No changes to `src/procedure/*`, database, migrations, corpus, deployment, or War Room assets.

## Acceptance Criteria

1. Overview remains the default.
2. A visible depth selector offers overview and deep dive.
3. Procedure requests carry the selected `depth` query parameter.
4. Deep-dive cards show evidence status and statements.
5. Dependencies are rendered as a separate structured section.
6. Responsible role/unit and deadlines appear only when provided.
7. Citations are expandable and show label, excerpt, authority class, evidence use, and page when available.
8. Gaps and human-validation warnings remain visible.
9. Demo mode returns a deep-dive-shaped response when requested, without fabricated authority.
10. Pages build and verification require the new script.
11. Focused and full local gates pass before closure.
