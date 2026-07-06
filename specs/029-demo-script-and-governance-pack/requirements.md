# Feature 029 — Demo Script and Governance Pack

## Objective

Prepare LA Muni RAG for a credible municipal presentation by adding a demo script, governance notes, stakeholder talking points, and readiness checks without changing runtime behavior.

## Requirements

1. Provide a municipal demo script that a presenter can follow in 7 to 10 minutes.
2. Include approved demo queries for public-document consultation.
3. Explain how to interpret evidence, limited coverage, and no-result answers in non-technical Spanish.
4. Provide governance guardrails for municipal stakeholders: transparency, citation use, scope limits, and human review.
5. Include answers to likely objections from legal, IT, communications, and municipal leadership.
6. Preserve all current runtime behavior: no backend, retrieval, API, corpus, auth, or environment changes.
7. Keep frontend public copy in Spanish and avoid internal engineering language in public-facing surfaces.
8. Add static tests that verify the demo/governance pack exists and contains required municipal-readiness sections.

## Non-goals

- No new APIs.
- No change to ranking or answer generation.
- No change to database or embedding behavior.
- No new dependencies.
- No presentation slide file in this feature.
