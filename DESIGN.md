# LA Muni RAG product design system

Status: current design contract for public and authenticated product surfaces.

## Product character

The interface is civic, technical and calm. It should feel trustworthy and
modern without resembling a marketing microsite or a science-fiction dashboard.
Every visible claim must correspond to runtime evidence.

## Implementation choice

Use modular, dependency-free CSS and JavaScript for the public shell and the
Shadow DOM widget. Do not introduce Tailwind for these surfaces. The product is
embedded in external sites, served by GitHub Pages, and packaged in the backend
container; modular assets keep those boundaries portable and auditable.

## Visual tokens

The public frontpage uses the `heritage-burgundy` theme. It is intentionally
editorial and restrained rather than neon or dashboard-like.

- Background: warm ivory `#f7f3ee`.
- Surface: opaque paper `#fffdf9` or white.
- Primary text: warm charcoal `#282222`.
- Secondary text: `#625b56`; quiet text: `#786f69`. Both meet 4.5:1 on the
  declared paper surfaces.
- Interaction and brand color: burgundy `#731729`, reserved for primary
  buttons, links, focus and active controls.
- Soft burgundy `#f4e8ea` supports hover and explanatory surfaces without
  becoming a competing call to action.
- Warm neutrals may support architectural illustration. Cyan, violet and pink
  gradients are not part of the public frontpage palette.
- Success, warning and error colors communicate actual state only.

Technical rooms may retain a dark background when it improves dense telemetry,
but they must still use one dominant accent and avoid decorative rainbow color.

## Typography and hierarchy

- One dominant product promise in the hero.
- Body copy uses comfortable line length and at least 1.55 line height.
- Section headings describe a user task, not implementation self-praise.
- Avoid phrases such as “premium”, “demo”, “built to operate”, or “why trust us”
  in the product UI.

## Components

### Navigation

Assistant and Glass Wall are primary destinations. Academy and installation are
secondary. Authenticated products may add Library, Procedures, Cases, Review,
Audit and Administration according to role.

### Primary action

Use the reserved burgundy fill with light text. Secondary actions use a solid
opaque paper surface. Minimum touch target is 44 by 44 CSS pixels.

### Evidence

Never label documents “verified”, “official”, “current” or “applicable” unless
those states arrive from an authoritative backend contract. Show citation,
version, jurisdiction, dates and limitations together.

### Empty and unavailable states

Unavailable infrastructure is a first-class state. Disable unsafe controls and
explain the missing configuration. Never replace missing data with sample
answers on a production-facing surface.

## Accessibility

- WCAG 2.1 AA contrast is the minimum automated target.
- All controls require a visible `:focus-visible` treatment.
- Respect reduced motion.
- Do not encode status by color alone.
- Modal/widget focus management and screen-reader behavior require browser and
  human verification before production.

## Responsive behavior

Keep the hero two-column on laptop layouts. Stack content and remove absolute
panel positioning below tablet width. The widget must fit the dynamic viewport,
retain readable text and preserve access to close/send controls.

## Motion

Ambient motion may support hierarchy but cannot communicate required state.
Use few slow animations, stop them for reduced motion, and avoid continuous
movement behind paragraph text.
