# Design — Procedure Feedback Backend API

## Architecture

```text
Authenticated client
  ↓
POST /api/procedure-feedback
  ↓
Bearer-token guard
  ↓
In-memory write rate limit
  ↓
Strict payload validation and normalization
  ↓
ProcedureFeedbackRepository
  ↓
agent.procedure_feedback
```

```text
Authenticated reviewer
  ↓
GET /api/procedure-feedback?limit=50&feedbackType=missing_document&workflowId=...
  ↓
Bearer-token guard
  ↓
Validated filters
  ↓
ProcedureFeedbackRepository
  ↓
Newest records + total count
```

## Modules

```text
src/procedureFeedback/types.ts
src/procedureFeedback/validation.ts
src/procedureFeedback/auth.ts
src/procedureFeedback/rateLimit.ts
src/procedureFeedback/repository.ts
src/procedureFeedback/index.ts
```

## Dependency Injection

`ServerOptions` gains an optional `procedureFeedbackDependencies` object. Tests can inject an in-memory repository, token, and clock without connecting to PostgreSQL.

Default runtime dependencies use:

- `PROCEDURE_FEEDBACK_API_TOKEN`;
- PostgreSQL `pool`;
- system clock;
- bounded in-memory rate limiter.

## Authentication

The API requires:

```http
Authorization: Bearer <token>
```

The configured token is never returned or logged. Comparison uses equal-length buffers and `timingSafeEqual`.

If no token is configured, feedback routes return:

```json
{
  "error": {
    "code": "feedback_api_disabled",
    "message": "Procedure feedback API is not configured"
  }
}
```

with HTTP `503`.

## Validation Contract

Required POST fields:

- `workflowId`
- `workflowTitle`
- `procedureType`
- `jurisdiction`
- `confidence`
- `query`
- `stepNumber`
- `stepTitle`
- `feedbackType`
- `comment`

Allowed values mirror the frontend and procedure model. Text is trimmed, Unicode-normalized, stripped of disallowed control characters, and length-bounded.

## Rate Limiting

MVP rate limit:

- 20 POST requests per 10-minute window per direct socket address.
- No forwarded-header trust.
- No address persistence.
- GET is not rate-limited in this slice because it is token-protected and bounded.

## Database

Migration `002_procedure_feedback.sql` creates `agent.procedure_feedback` with:

- UUID primary key;
- workflow metadata;
- feedback details;
- `is_external_reference` generated from jurisdiction;
- `retention_until`, defaulting to 180 days;
- indexes for review and cleanup.

No request headers, IP address, cookies, or authentication data are stored.

## Frontend Boundary

The existing local-only feedback UI remains unchanged. This feature does not embed a token in public JavaScript and does not automatically POST from GitHub Pages.

A future authenticated internal client can use the new API.
