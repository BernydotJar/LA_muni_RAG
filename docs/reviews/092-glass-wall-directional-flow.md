# Feature 092 — directional Glass Wall review

## Scope and roles
The user approved implementing the proposed directional map and UI adjustment. The application uses the existing pinned Graph Harness SDLC runtime; no framework code is copied or redesigned. This change is confined to the public Glass Wall, its tests, artifact checks and evidence. No backend, cloud, corpus, identity, tenancy or billing mutation is included.

Producer and critic are separate passes by the same assistant. Independent verification means a fresh process and detached checkout of the implementation commit, not a second human reviewer or a separately authenticated agent. The independent-checkout result and remote CI receipts are recorded separately; neither is assumed here.

## Critic findings and localized repairs

| Finding | Repair | Verification |
|---|---|---|
| Connectors had no direction and crossed unrelated internal nodes. | Six directed boundary-to-boundary SVG paths over a five-stage HTML grid; internal capabilities moved to a disconnected disclosure. | EVAL topology/geometry and browser marker/port assertions. |
| Selected modes and citation counts could imply execution of unreported internal capabilities. | Arrows derive from completed route responses. No vector, embedding, index or audit edge exists. | Single-mode, empty and partial-route tests. |
| Static-first retrieval was described as server health or auditing. | Response provenance uses the static-fallback header. Local-copy results explicitly do not attest server health or audit. | Frozen public-corpus browser verification without managed API requests. |
| Raw status codes clipped the results panel. | Spanish state labels, separate fragment/document counts, source cards below the flow. | Responsive checks at 320, 390, 760, 768, 1024 and 1440 CSS pixels. |
| Whole-diagram scaling made mobile nodes unreadable. | Vertical flow below 760px; node text remains at least 12px; arrows are remeasured with ResizeObserver. | DOM geometry after repeated breakpoint crossings; no horizontal page overflow. |
| Late responses could overwrite a newer inspection. | Request sequence fencing and cancellation; loading clears prior citations. | Deliberately reversed response order in browser tests. |
| A transport/protocol failure could look like missing evidence. | Separate empty/error/partial states; malformed metadata rejected; partial results keep only completed routes. | Empty, transport, malformed, 429 and partial tests. |
| Unbounded or never-completing responses could leave the UI unusable. | Streaming 64 KiB response bound, 12-second timeout and cancellation. | Oversized response and virtual-clock timeout tests. |
| Replacing SVG paths during resize produced transient detached-element observations. | Stable keyed path elements; only attributes are updated. | Repeated geometry and forced-colors computed-style checks. |
| Untrusted query/citation markup could become active DOM. | textContent-only rendering; HTTPS links without credentials; noopener/noreferrer. | Markup-inert browser test and URL rejection EVAL. |

## Verification-environment repairs
The shared workstation already had the default test port occupied. Playwright now honors the existing PLAYWRIGHT_PORT setting; the credentials-stripping test derives its expected origin from baseURL. Its authorization/cookie denial assertions remain unchanged.

The Pages verifier now checks that the API bridge precedes the external Glass Wall module, and that all three new local assets are present. This replaces an obsolete inline-script-position assertion, not a security requirement. Public-only desktop/mobile screenshots are retained as CI artifacts for seven days.

A clean dependency install exposed two pre-existing vulnerable transitive packages. Only the lock entries were updated within their existing ranges: @xmldom/xmldom 0.8.13 → 0.8.15 and fast-uri 3.1.5 → 3.1.8. No new dependency or major version was introduced. Full and production-only npm audit report zero vulnerabilities after the repair.

Primary advisory references checked during this work:
- https://github.com/advisories/GHSA-93r5-fhx6-vmg9
- https://github.com/advisories/GHSA-f65p-4m7j-42xc

## Evidence boundaries
The map is an explanation of the public response contract, not a full server trace. It does not expose or claim model reasoning, semantic retrieval, server audit persistence, legal correctness or corpus completeness. Showing five fragments is not the same as five distinct documents.

The attached architecture note distinguishes offline ingestion from online retrieval and requires evidence before claims. The UI follows that distinction; the note is contextual documentation, not a source of live runtime telemetry.

## Prepublication disposition
Local adversarial pass: no unresolved critical/high finding in this change. Named EVAL and focused browser checks pass. Release remains pending independent-checkout validation, exact-head CI and any separately recorded public deployment verification. The pre-existing untracked architecture audit is preserved and excluded from commits.
