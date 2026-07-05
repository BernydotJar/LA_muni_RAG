# Tasks — 026-chat-answer-quality-and-evidence-composition

## Implementation

- [x] Add requirements and design specs.
- [x] Register feature 026 in `feature_list.json`.
- [x] Add synthesis-first response composition in `public/widget.js`.
- [x] Add raw retrieval-dump detection.
- [x] Add theme extraction from citations.
- [x] Add collapsible evidence section.
- [x] Add follow-up chips for broad queries.
- [x] Preserve `/api/chat` request behavior.
- [x] Preserve mode switching.
- [x] Preserve citation expansion.
- [x] Preserve responsive and reduced-motion behavior.
- [x] Add regression tests.
- [x] Update `progress/current.md`.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`

## Manual Review

- [ ] Query `agua` shows synthesis before evidence.
- [ ] Evidence is collapsed by default.
- [ ] Citation cards expand when clicked or keyboard activated.
- [ ] Follow-up chips appear for broad queries.
- [ ] The answer no longer reads like a raw numbered retrieval dump.
- [ ] No backend behavior changed.
