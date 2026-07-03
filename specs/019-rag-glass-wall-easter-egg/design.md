# Design: RAG Glass Wall Easter Egg

Feature: 019-rag-glass-wall-easter-egg  
Mode: SHIP

## Concept

The RAG Glass Wall is a CTO/operator transparency view.

It visualizes a safe, observable slice of the RAG pipeline as a node graph:

```text
query/input -> retrieval modes -> evidence candidates -> answer status
```

The visual metaphor is a glass wall: the user can see signals flowing through the system without exposing hidden reasoning, prompts, secrets, raw credentials, or chain-of-thought.

## Proposed Implementation

Recommended SHIP implementation:

```text
public/glass-wall.html
```

This keeps the feature isolated and avoids package changes, build tooling changes, framework routing changes, migrations, or new server endpoints.

The page can use plain HTML, CSS, and browser JavaScript.

## Data Sources

Use existing endpoints only:

```text
GET /health
GET /api/evidence?q=<query>&mode=hybrid
GET /api/answer?q=<query>&mode=hybrid
```

If `mode=hybrid` is not accepted by an endpoint, the implementation should safely fall back to the existing default behavior.

## Visual Layout

### Layer 1: Query Signals

Nodes:

- query
- mode
- corpus

### Layer 2: Retrieval Paths

Nodes:

- phrase
- keyword
- vector
- runtime

### Layer 3: Evidence Candidates

Nodes:

- evidence 1
- evidence 2
- evidence 3
- citation

### Layer 4: Final State

Nodes:

- answer
- not_found
- degraded

## Path Highlighting

Use active styling for:

- evidence found
- answer status is evidence_found or draft_grounded
- citation-bearing evidence
- vector runtime enabled

Use muted styling for:

- no evidence
- vector runtime disabled
- degraded dependency state

## Safety Model

Do show:

- query text entered by the user
- answer status
- evidence count
- source type
- citation labels
- safe excerpts returned by existing APIs
- sanitized vector runtime state from `/health`

Do not show:

- prompts
- chain-of-thought
- provider keys
- database URLs
- env values
- raw hidden model messages
- stack traces
- full sensitive document dumps

## Error Handling

The page should handle:

- network failure
- non-JSON response
- empty evidence
- answer `not_found`
- vector runtime disabled/degraded

Errors should render as safe UI states, not raw stack traces.

## Styling

Recommended style:

- dark background
- thin gray inactive edges
- magenta/pink active edges
- small monospaced labels
- compact node graph
- no external fonts or assets required

## Testing Strategy

Preferred minimal automated test:

```text
src/__tests__/glass-wall-static.test.ts
```

The test can assert that:

- `public/glass-wall.html` exists
- it references only expected endpoints
- it does not contain obvious secret marker strings
- it includes stable DOM anchors for query, graph, and result panels

This avoids browser automation and keeps the test offline.

## Future Enhancements

Post-MVP possibilities:

- animated edge flow
- evidence score labels
- source-type badges
- retrieval timeline
- toggle between keyword/phrase/vector modes
- admin-only feature flag
- integration into a real dashboard

These are intentionally out of scope for SHIP.
