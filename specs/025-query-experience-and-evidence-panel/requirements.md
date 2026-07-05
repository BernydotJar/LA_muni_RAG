# Requirements — 025-query-experience-and-evidence-panel

## Mode

SHIP

## Goal

Refine the embeddable chat widget so it feels like a premium municipal evidence panel rather than a basic chat window.

The widget should remain a lightweight static JavaScript embed and must continue using the existing `/api/chat` contract.

## User Problem

The current widget is functional, but the conversation surface feels visually less premium than the refreshed homepage. The assistant responses and citation cards look dense, generic, and utilitarian. The widget should visually match the institutional/cinematic direction of the public frontend while preserving evidence-first behavior.

## Scope

### In scope

- Premium visual refresh for `public/widget.js`.
- Improved chat shell, header, bubble, message cards, evidence/citation cards, search-mode control, input area, and mobile layout.
- CSS-only motion and depth effects.
- Improved citation readability without changing data shape.
- Static regression tests for the premium widget surface.
- Harness progress tracking.

### Out of scope

- Backend API changes.
- Retrieval ranking changes.
- Answer generation changes.
- Corpus, indexing, embedding, or database changes.
- Widget package/bundler changes.
- New dependencies.
- Secrets, auth, migrations, or deployment changes.

## Functional Requirements

- The widget must still read configuration from the current script tag:
  - `data-api-url`
  - `data-position`
  - `data-theme`
  - `data-title`
- The widget must still POST user messages to `/api/chat` using the existing request shape:
  - `message`
  - `mode`
  - `limit`
- The widget must preserve keyword and phrase search modes.
- The widget must preserve citation rendering and citation expand/collapse behavior.
- The widget must preserve the floating bubble open/close behavior.
- The widget must preserve keyboard send behavior with Enter and close behavior with Escape.
- The widget must preserve mobile responsiveness.

## Visual Requirements

- The widget should feel like a premium municipal evidence console.
- The shell should use deep glass, institutional gradients, subtle glow, and clear hierarchy.
- Assistant responses should feel like evidence cards, not plain chat blobs.
- Citation cards should read as source dossiers with source badge, label, excerpt, and interaction affordance.
- The input/composer should feel intentional and premium.
- The mode selector should feel like a segmented control, not plain tabs.
- Motion must be CSS-only and respect `prefers-reduced-motion`.

## Acceptance Criteria

- `public/widget.js` includes premium widget shell classes and styles.
- The widget no longer relies on external font imports.
- Chat API behavior is preserved.
- Keyword/phrase mode behavior is preserved.
- Citation rendering and expansion remain preserved.
- Mobile layout remains usable below 480px.
- Reduced-motion rules cover widget animations.
- Tests verify the premium chat surface and preserved behavior.

## Verification Commands

Run locally before closing:

```sh
npm run typecheck
npm run build
npm run test
```
