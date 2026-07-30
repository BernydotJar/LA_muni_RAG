# Independent review — Feature 086 real-corpus retrieval evaluation

## Verdict

PASS WITH DOCUMENTED QUALITY GAPS, pending exact-SHA remote CI.

## Scope reviewed

The evaluation uses the exact controlled PDM-OT corpus produced by Feature 085: one document, SHA-256 `824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b`, 224 extracted sections and 444 tenant-scoped chunks. DMP v3 is excluded because its official PDF has no extractable text and is not credited as ingested.

The frozen set contains eight positive page-judged queries and four no-answer cases. It measures phrase, PostgreSQL Spanish full-text keyword, deterministic lexical-vector and the existing hybrid combiner. The vector representation is not semantic.

## Final measured results

| Mode | Hit@5 | MRR | Top-1 citation identity | Unsupported-answer rate | Cross-document leakage | Frozen target status |
|---|---:|---:|---:|---:|---:|---|
| Phrase | 0.750 | 0.646 | 0.500 | 0.000 | 0.000 | Quality gaps |
| Keyword | 0.750 | 0.580 | 0.375 | 0.000 | 0.000 | Quality gaps |
| Lexical vector | 0.750 | 0.618 | 0.500 | 0.000 | 0.000 | Pass |
| Hybrid | 0.875 | 0.604 | 0.375 | 0.000 | 0.000 | Quality gaps |

The result is `measured_with_quality_gaps`, not a retrieval-quality pass.

## Critic and red-team findings

### Finding 1 — initial answer threshold admitted no-answer cases

The excluded calibration run used a lexical-vector answer threshold of 0.20. Three of four frozen no-answer cases exceeded that value. The final threshold was raised to 0.35 before the final evidentiary run. The cases and quality targets were not changed. The final run produced zero eligible answers for every no-answer case in every mode.

### Finding 2 — citation accuracy must evaluate the top answer

The first implementation counted the first relevant candidate anywhere in the result list as a valid citation. That overstated answer quality. The final metric requires the top-ranked candidate itself to match the expected document and page range.

### Finding 3 — phrase matching needed line-break tolerant retrieval

Exact substring phrase retrieval missed phrases split by PDF layout. The final phrase mode uses PostgreSQL `phraseto_tsquery('spanish', ...)`, with exact substring only as a ranking boost. This is still lexical phrase retrieval, not semantic search.

### Finding 4 — ranking quality remains insufficient

Phrase, keyword and hybrid achieve useful hit-at-five coverage but fail the frozen MRR and top-1 citation targets. The hybrid result has the best hit-at-five value but does not reliably promote the correct citation to rank one. Optimizing weights or cases against this same twelve-case set would be overfitting. A broader corpus, independent held-out judgments and human relevance review are required before changing production ranking.

## Security and integrity review

- The evaluation runs against persisted PostgreSQL/pgvector rows under tenant context.
- It verifies one document, 444 chunks, exact document version and exact source SHA before evaluating.
- No-answer eligibility uses a frozen conservative threshold.
- All four modes have zero unsupported-answer rate and zero cross-document leakage in this set.
- Raw PDFs remain outside Git.
- CI validates the committed query set and receipt without network, PDF or database credentials.
- Receipts contain no database URL, password, user query outside the frozen set or productive provider credential.

## Limitations

- One document and twelve cases cannot establish general municipal retrieval quality.
- The lexical hash vectors are deterministic evaluation features, not a semantic model.
- Legal correctness, source vigencia, corpus completeness, accessibility, latency SLOs and production operations are not measured.
- DMP v3 is excluded because it has no text layer.
- The measured quality gaps remain release blockers for a broad retrieval-quality claim.
- Exact-SHA remote CI is still required before the Graph Harness gate can close.
