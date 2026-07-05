# Design — 025-query-experience-and-evidence-panel

## Design Intent

Upgrade the embeddable widget from a generic chat UI to a premium civic evidence panel aligned with the refreshed homepage.

The widget should communicate:

- institutional trust;
- verified municipal documents;
- evidence-first answers;
- readable citation cards;
- controlled, auditable interaction.

## Files Allowed to Change

- `public/widget.js`
- `src/__tests__/premium-chat-widget.test.ts`
- `feature_list.json`
- `progress/current.md`
- `specs/025-query-experience-and-evidence-panel/*`

## Files Not to Touch

- Backend routes and APIs.
- Retrieval/evidence ranking code.
- Answer generation code.
- Database schema and migrations.
- Environment/secrets files.
- `public/glass-wall.html`.
- `public/assets/civic-institutional-hero.svg` unless a later visual feature explicitly scopes it.

## Current Widget Behavior to Preserve

- Reads config from `document.currentScript`.
- Injects Shadow DOM into `#muni-rag-widget`.
- Uses `/api/chat` with `message`, `mode`, and `limit`.
- Maintains `keyword` and `phrase` modes.
- Renders citations from `data.citations`.
- Allows citation expand/collapse.
- Shows typing indicator.
- Supports open/close bubble.
- Keeps responsive behavior and reduced-motion support.

## Visual System

### Shell

Use a dark civic glass surface with:

- saturated blur;
- layered radial highlights;
- subtle border glow;
- premium shadow;
- rounded but more deliberate geometry.

### Header

Make the header more like an institutional command surface:

- civic icon block;
- title;
- verified-document status;
- small status pill;
- subtle gradient and rail line.

### Messages

User messages should look like polished command chips.

Assistant messages should read as evidence panels:

- top label: `Respuesta con evidencia`;
- body copy in readable line length;
- softer background with left accent glow.

### Citation Cards

Each citation should become a compact evidence dossier:

- source badge;
- evidence index;
- citation label;
- excerpt block;
- hover/expanded state.

### Controls

The mode selector should become a segmented control integrated with the composer.

The input should use a premium glass field and a clear send button.

### Accessibility and Motion

- Preserve keyboard send and Escape close.
- Preserve readable contrast.
- Honor `prefers-reduced-motion`.
- Avoid motion that blocks reading.

## Implementation Notes

This feature should not change the API or response schema. It only changes rendering and CSS in `public/widget.js`.
