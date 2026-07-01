# 004 Deterministic Answer Endpoint - Design

Status: Implemented

## Flow

```text
GET /api/answer
  -> src/server.ts
  -> buildDeterministicAnswer()
  -> findEvidence()
  -> search.ts
  -> PostgreSQL read-only retrieval
```

## Truth Model

The endpoint is deterministic and evidence-bound:

- `draft_grounded`: evidence exists, so the endpoint may summarize retrieved
  excerpts and cite them.
- `not_found`: no evidence exists, so the endpoint abstains.

The endpoint labels grounded output as `draft` because it is not a final legal,
technical, or municipal determination.

## Read-only Contract

The endpoint performs retrieval only. It does not write to PostgreSQL, generate
embeddings, or call external AI services.

