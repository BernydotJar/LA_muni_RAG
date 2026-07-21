# Decision 063 — Ship public training before authenticated SaaS

Date: 2026-07-21
Status: accepted for feature implementation

## Decision

Deliver the first Procedure Academy as a clearly public, read-only training
preview. Do not add a browser login, tenant switcher or protected case/review UI
until a human identity provider and server-side session/BFF architecture are
approved and implemented.

Only bounded, non-sensitive learning progress may be stored locally. Integration
Bearer credentials must never be used as browser credentials or persisted in
JavaScript storage.

## Rationale

- the current backend credentials are designed for service/integration clients;
- putting them in browser code would create a critical credential disclosure and
  tenant-boundary failure;
- the training experience creates immediate product value without requiring fake
  security or case persistence;
- disabled SaaS navigation communicates the target information architecture
  without claiming unavailable capability;
- evidence/missing-information literacy can be evaluated independently from
  institutional completion or legal applicability.

## Consequences

- public progress is convenience state, not an official training record;
- no certificate, approval or case completion can be produced;
- browser authentication, cases, reviews and admin remain separate P0/P1 slices;
- accessibility status is scoped to this static surface until real browser and
  assistive-technology evidence exists.
