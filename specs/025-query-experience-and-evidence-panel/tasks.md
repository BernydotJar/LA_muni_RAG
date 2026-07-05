# Tasks — 025-query-experience-and-evidence-panel

## Implementation

- [x] Register feature 025 in `feature_list.json` as SHIP/review/active.
- [x] Add requirements, design, and tasks spec files.
- [x] Refresh `public/widget.js` visual system.
- [x] Preserve `/api/chat` request behavior.
- [x] Preserve search mode switching.
- [x] Preserve citation rendering and expand/collapse behavior.
- [x] Preserve open/close bubble behavior.
- [x] Preserve responsive and reduced-motion behavior.
- [x] Add regression tests for premium widget shell and preserved behavior.
- [ ] Update `progress/current.md`.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`

## Manual Review

- [ ] Widget shell feels premium and aligned with homepage.
- [ ] Assistant responses are readable as evidence panels.
- [ ] Citation cards feel premium and remain expandable.
- [ ] Search mode control is clear.
- [ ] Mobile widget remains usable.
- [ ] No backend behavior changed.
