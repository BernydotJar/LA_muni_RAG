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

- Background: near-black navy, not pure black.
- Surface: opaque navy sufficient to preserve text contrast over ambient art.
- Primary text: `#f8fafc`.
- Secondary text: `#cbd5e1` or a darker-background equivalent meeting 4.5:1.
- Interaction color: cyan `#67e8f9`, reserved for buttons, links, focus and
  active controls.
- Purple/pink: ambient decoration and data accents only; never compete with the
  primary action.
- Success, warning and error colors communicate actual state only.

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

Use the reserved cyan fill with dark text. Secondary actions use a solid opaque
surface. Minimum touch target is 44 by 44 CSS pixels.

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
