# ADR 082 — Task-first civic workspace and canonical shell paths

Date: 2026-07-28
Status: accepted for the local provider-neutral foundation

## Context

The authenticated shell proved session lifecycle and permission-aware visibility, but its main view exposed technical counts and a flat list of modules. The planned browser journeys use path-based entry points that previously returned 404. This made the interface look generic and kept journey structure disconnected from the runnable shell.

PixelRAG was reviewed only as a public product reference: its search surface emphasizes one primary task, progressive disclosure and honest loading, error and result states. No PixelRAG code, visual assets or deployment architecture were copied. LA Muni RAG retains its own security, tenancy, governance and vanilla same-origin asset boundaries.

Reference: https://github.com/StarTrail-org/PixelRAG

## Decision

- Center the first authenticated view on finding and sustaining municipal evidence.
- Group navigation by work, corpus and governance.
- Move session identifiers and capability counts into a details disclosure.
- Serve an explicit allowlist of canonical deep-link paths from the protected API shell.
- Compose that allowlist into the API server's BFF return paths and derive `return_to` from the current exact path.
- Map paths and task shortcuts through static route allowlists and effective local permissions.
- Push history for deliberate user navigation and replace history only for bootstrap or safe normalization.
- Fall back to overview for denied or malformed routes with a fixed, non-reflective message.
- Distinguish denial and success feedback visually, clear stale denial feedback and enforce focus contrast deterministically.
- Give provider adapters closed authentication-rejection and transient-unavailability error types.
- Show verified blockers instead of fake search results or sample municipal data.
- Preserve the existing CSP, POST-only BFF lifecycle, CSRF, no-Bearer and no-storage controls.
- Keep the implementation dependency-free and inside the existing API-served shell.

## Consequences

The shell is more legible, task-oriented and aligned with journey URLs. Exact deep links survive the deterministic local login and user navigation respects browser history. The provider boundary can report safe recovery semantics without leaking diagnostics. Route foundations can be exercised locally without claiming complete workflows. Productive search, corpus, IdP and human acceptance remain separate human-gated work.

