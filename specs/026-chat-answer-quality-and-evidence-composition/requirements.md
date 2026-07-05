# Requirements — 026-chat-answer-quality-and-evidence-composition

## Mode

SHIP

## Goal

Improve the conversational quality of the embeddable chat widget so answers no longer feel like raw retrieval dumps. The chat should present a short synthesis first, then visible verified evidence, then guided follow-up chips.

## User Problem

The widget is visually more premium, but responses still read like a search result list: long numbered references, repeated snippets, and dense evidence mixed directly into the main answer. This makes the product feel less like a municipal assistant and more like a retrieval/debug surface.

## Scope

### In scope

- Frontend response composition in `public/widget.js`.
- Compact synthesis-first assistant cards.
- Evidence section visible by default with optional hide control.
- Evidence summary/source stack.
- Guided follow-up chips for broad queries.
- Tests protecting composition behavior and preserved API contract.
- Harness tracking.

### Out of scope

- Backend API changes.
- Retrieval ranking changes.
- Prompt/model changes.
- Database, corpus, embeddings, migrations, auth, secrets, package files.
- Homepage and Glass Wall visual changes.

## Functional Requirements

- Preserve the `/api/chat` request shape: `message`, `mode`, `limit`.
- Preserve `keyword` and `phrase` search modes.
- Preserve citation expand/collapse behavior.
- Preserve Shadow DOM isolation.
- Preserve bubble open/close, Enter send, and Escape close.
- Detect raw retrieval-style answer content and avoid rendering it as the primary assistant response when citations are present.
- Render a short synthesis before evidence.
- Render citation evidence expanded by default to avoid an unnecessary extra click.
- Allow users to hide evidence when they want a compact view.
- Render follow-up chips based on the query/evidence themes.
- Preserve reduced-motion support.

## Acceptance Criteria

- Assistant response card includes a synthesis-first block.
- Long citation lists are not duplicated in the main answer when `data.citations` exists.
- Evidence is visible by default under `Fuentes verificadas`.
- The evidence section can still be hidden with `Ocultar evidencia`.
- Source cards remain expandable and keyboard accessible.
- Broad queries produce guided follow-up chips.
- Existing widget API behavior remains unchanged.
- Tests verify composition, expanded evidence default, follow-up chips, and preserved contract.

## Verification Commands

Run locally before closing:

```sh
npm run typecheck
npm run build
npm run test
```
