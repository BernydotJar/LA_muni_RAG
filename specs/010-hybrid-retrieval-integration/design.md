# Design: Hybrid Retrieval Integration

Feature: 010-hybrid-retrieval-integration  
Mode: SHIP

## Overview

Feature 009 created the hybrid ranking layer:

```text
phrase candidates
keyword candidates
vector candidates
  -> dedupe
  -> score
  -> rank
```

Feature 010 integrates that layer into the live retrieval/evidence flow.

## Current State

The current evidence path supports:

```text
keyword mode -> keywordSearch -> EvidenceItem[]
phrase mode  -> phraseSearch  -> EvidenceItem[]
```

The deterministic answer path calls the evidence layer and then decides:

```text
not_found      -> no answer, no citations
evidence_found -> grounded draft with citations
```

## Target State

The target path adds a controlled hybrid mode:

```text
hybrid mode
  -> phraseSearch
  -> keywordSearch
  -> vector candidate boundary
  -> buildHybridRetrievalResult
  -> EvidenceItem[]
  -> existing deterministic answer policy
```

## Integration Strategy

The safest integration is to extend the evidence layer with `hybrid` while preserving existing behavior for `keyword` and `phrase`.

Candidate mapping should be explicit:

- phrase results map to phrase hybrid candidates
- keyword results map to keyword hybrid candidates
- vector results map through the vector boundary from 009

## API Mode

If public endpoints validate retrieval modes, `hybrid` should be added as an accepted mode.

Existing invalid-mode tests must be updated to ensure bad modes still return 400.

## Vector Boundary

This feature should not introduce external embedding calls.

For now, vector integration may be interface-bound or deterministic in tests. A production vector repository may remain a later feature if database schema or pgvector search is required.

## Evidence Mapping

Hybrid candidates should map into the existing `EvidenceItem` shape.

The following fields must be preserved:

- documentTitle
- sourceType
- citationLabel
- pageStart
- excerpt
- score
- retrievalMode

If matched modes are available, they may be placed in metadata only if the public type is intentionally extended.

## Answer Policy

The answer layer must not infer anything new.

The policy remains:

```text
No evidence = no answer.
Evidence = grounded draft.
```

## Explicit Constraints

This feature must not:

- introduce an LLM call
- introduce LLM reranking
- alter ingestion
- alter package dependencies
- add migrations without a separate approval
- change UI
- change secrets or env files
