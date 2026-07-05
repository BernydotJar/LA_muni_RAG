# Tasks — 026-chat-answer-quality-and-evidence-composition

## Implementation

- [x] Add requirements and design specs.
- [ ] Register feature 026 in `feature_list.json`.
- [ ] Add synthesis-first response composition in `public/widget.js`.
- [ ] Add raw retrieval-dump detection.
- [ ] Add theme extraction from citations.
- [ ] Add collapsible evidence section.
- [ ] Add follow-up chips for broad queries.
- [ ] Preserve `/api/chat` request behavior.
- [ ] Preserve mode switching.
- [ ] Preserve citation expansion.
- [ ] Preserve responsive and reduced-motion behavior.
- [ ] Add regression tests.
- [ ] Update `progress/current.md`.

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
