# 004 Deterministic Answer Endpoint - Requirements

Status: Implemented

## Objective

Add `GET /api/answer` as a deterministic grounded-answer endpoint for the
evidence-first RAG foundation.

## Acceptance Criteria

- Calls `findEvidence()`.
- Returns `answerStatus: "draft_grounded"` when evidence exists.
- Returns `answerStatus: "not_found"` when evidence does not exist.
- Includes citations when evidence exists.
- Does not invent legal or municipal claims.
- Does not call an LLM.
- Does not create embeddings.
- Does not mutate the database.

## Non-goals

- No model-generated legal interpretation.
- No vector search.
- No UI changes.
- No schema or migration changes.

