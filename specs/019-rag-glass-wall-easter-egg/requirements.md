# Requirements: RAG Glass Wall Easter Egg

Feature: 019-rag-glass-wall-easter-egg  
Mode: SHIP  
Status: spec_ready

## Product Intent

Add a CTO-facing easter egg called the RAG Glass Wall: a visual transparency surface that lets an operator see how a query moves through the RAG system.

The visual style is inspired by neural-network / agent-sense diagrams: inputs on the left, intermediate nodes in the middle, final evidence/answer state on the right, with highlighted paths showing which retrieval signals contributed to the result.

This is not decorative only. It should communicate system behavior:

- query input
- retrieval modes
- candidate evidence
- citation readiness
- answer status
- runtime vector state
- degraded or disabled paths

## Problem

The backend already has retrieval, evidence, vector runtime status, and deterministic answer behavior, but the system does not yet expose a lightweight transparent visualization for technical stakeholders.

A CTO/operator should be able to inspect the system like looking through a glass wall: not private chain-of-thought, not hidden prompts, not secrets, but observable operational state.

## Goal

Define a minimal, safe, self-contained glass-wall visualization that can be served from the existing app without changing answer policy, retrieval ranking, or security posture.

## Non-Goals

This feature does not implement:

1. Chain-of-thought exposure.
2. Prompt leakage.
3. Secrets display.
4. Database credentials display.
5. Provider key display.
6. LLM reranking.
7. LLM answer generation changes.
8. Retrieval ranking changes.
9. Authentication changes.
10. Full admin UI.
11. Corpus management UI.
12. External visualization dependencies unless separately approved.
13. Image or video generation.
14. Social-media UI cloning.

## Functional Requirements

### FR-1: Glass Wall Page or View

Provide a lightweight glass-wall visualization surface.

Acceptable implementation options:

- static page under existing public assets
- small frontend view served by the current static server
- standalone HTML/JS/CSS asset

Recommended path if compatible with the current repo:

```text
public/glass-wall.html
```

### FR-2: Query Input

The page should allow an operator to enter a query.

### FR-3: Evidence Integration

The page should call existing safe public API endpoints such as:

```text
/api/evidence
/api/answer
/health
```

It must not require new server routes unless separately approved.

### FR-4: Visual Model

The visualization should show at least these columns/layers:

1. Query/input signals.
2. Retrieval modes or runtime paths.
3. Evidence candidates.
4. Final answer status / citation readiness.

### FR-5: Highlighted Path

The visualization should highlight useful or active paths:

- evidence found
- citation-bearing result
- vector runtime enabled/degraded/disabled
- not_found state

### FR-6: Safe Data Only

The visualization must only display safe API output:

- answer status
- evidence count
- source type
- citation labels
- excerpts/snippets already returned by the API
- sanitized vector runtime status

It must not display secrets, raw env values, prompts, model hidden reasoning, or chain-of-thought.

### FR-7: Easter Egg Access

The view should be intentionally discoverable but not disruptive.

Acceptable options:

- route/page hidden by direct URL
- small keyboard shortcut
- query parameter trigger

For SHIP scope, a direct URL is sufficient.

### FR-8: Graceful Degradation

The page must handle:

- no evidence
- server unavailable
- malformed response
- vector runtime disabled/degraded

### FR-9: Offline Tests or Static Validation

Because this is primarily a UI/static artifact, include at least one automated validation if feasible:

- static asset contains expected IDs/classes
- no secret tokens are hardcoded
- page references existing endpoints only

If current test structure makes UI testing too broad, document manual verification in `progress/current.md`.

## Visual Direction

The visual should use:

- dark background
- thin node/edge graph
- magenta/pink active path accent
- muted gray inactive paths
- compact labels
- RAG-specific labels, not game labels

Example labels:

```text
query
keyword
phrase
vector
runtime
citation
not_found
evidence
answer
```

## Acceptance Criteria

The feature can move to review when:

1. A glass-wall spec exists.
2. A minimal visual implementation exists after approval.
3. The implementation uses existing safe endpoints only.
4. It does not expose secrets, prompts, or chain-of-thought.
5. It does not change answer policy or retrieval ranking.
6. It handles empty/no-evidence states.
7. It handles degraded/disabled vector runtime status.
8. It is reachable by an intentional URL or trigger.
9. Local verification passes.
10. Harness state is updated.
