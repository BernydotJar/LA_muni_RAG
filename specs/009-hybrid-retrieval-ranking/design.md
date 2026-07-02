# Design: Hybrid Retrieval Ranking

Feature: 009-hybrid-retrieval-ranking  
Mode: SHIP

## Overview

This feature adds deterministic hybrid retrieval ranking to LA_muni_RAG.

Current retrieval is primarily lexical:

```text
query
  -> keyword search
  -> phrase search
  -> evidence
  -> deterministic answer
```

After this feature, retrieval should support:

```text
query
  -> phrase candidates
  -> keyword candidates
  -> vector candidates
  -> dedupe
  -> hybrid score
  -> ranked evidence
  -> deterministic answer
```

## Design Principle

Hybrid retrieval improves evidence discovery.

It must not weaken the evidence gate.

The system must still obey:

```text
No evidence = no answer.
Evidence = grounded draft.
```

## Proposed Module Layout

```text
src/retrieval/
  types.ts
  hybridScore.ts
  dedupe.ts
  hybridRetriever.ts
  vectorRetriever.ts
```

## Candidate Shape

All retrieval modes should normalize into one shape:

```ts
export type RetrievalMode = "phrase" | "keyword" | "vector";

export type HybridCandidate = {
  id: string;
  mode: RetrievalMode;
  documentId?: string;
  documentVersionId?: string;
  sectionId?: string;
  chunkId?: string;
  citationLabel: string;
  excerpt: string;
  sourceType?: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  articleNumber?: string | null;
  scores: {
    phrase?: number;
    keyword?: number;
    vector?: number;
    provenance?: number;
  };
  hybridScore: number;
  metadata?: Record<string, unknown>;
};
```

## Scoring Strategy

Hybrid scoring should be deterministic and explainable.

Initial score composition:

```text
hybridScore =
  phraseBoost +
  keywordWeightedScore +
  vectorWeightedScore +
  provenanceBoost
```

Recommended defaults:

```text
phrase match: strong boost
keyword match: medium/high depending rank score
vector match: medium depending similarity
complete citation metadata: small boost
```

## Deduplication

Candidates from multiple modes may point to the same section/chunk.

Deduplication should prefer:

1. same chunk id
2. same section id
3. same citation label + excerpt hash

When duplicates are found, preserve all contributing modes in metadata or score components.

## Phrase Priority

Exact phrase matches are legally important because they often correspond to precise text in the corpus.

Phrase candidates should not be buried under semantic-only matches.

## Vector Retrieval

Vector retrieval must be behind an interface.

Tests must use local deterministic vectors.

No external APIs are allowed in tests.

## Evidence Layer Compatibility

The hybrid retriever must return data that can be mapped into the current evidence response shape.

This feature may add a new retrieval mode internally, but it must not break existing endpoints.

## Explicit Constraints

This feature must not:

- call an LLM
- change `/api/answer` policy
- introduce unsupported legal conclusions
- require external APIs in tests
- alter ingestion extractors
- add UI changes
