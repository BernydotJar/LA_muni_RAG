# Feature 041 — Procedure Feedback Backend API

## Mode

MVP

## Objective

Add a secure backend API and PostgreSQL persistence layer for `ProcedureWorkflow` feedback. The API turns the local/exportable feedback loop from Features 039–040 into a server-side review signal without weakening Antigua-first governance or exposing credentials in the public frontend.

## Endpoints

```text
POST /api/procedure-feedback
GET  /api/procedure-feedback
```

Both endpoints require:

```http
Authorization: Bearer <PROCEDURE_FEEDBACK_API_TOKEN>
```

If the token is not configured, the endpoints must fail closed with `503 feedback_api_disabled`.

## POST Requirements

1. Accept one feedback item per request.
2. Validate a strict payload contract.
3. Generate record identity and timestamps server-side/database-side.
4. Normalize text and remove disallowed control characters.
5. Enforce field-length limits.
6. Allow only known procedure types, jurisdictions, confidence values, and feedback types.
7. Preserve `external reference` jurisdiction explicitly.
8. Return `201` with the persisted record.
9. Rate-limit writes by direct socket address; do not trust forwarded headers in this MVP.
10. Do not persist IP address, user-agent, authorization token, cookies, or request headers.

## GET Requirements

1. Require the same Bearer token.
2. Return newest records first.
3. Support bounded `limit`, `feedbackType`, and `workflowId` filters.
4. Return `{ items, total }`.
5. Never return authentication material or request metadata.

## Persistence Requirements

Create:

```text
db/migrations/002_procedure_feedback.sql
```

Table:

```text
agent.procedure_feedback
```

The table must:

- use UUID primary keys;
- use check constraints for enumerated values and text lengths;
- store workflow metadata needed for review;
- mark external-reference records;
- default retention to 180 days;
- include indexes for created time, workflow, type, and retention cleanup.

## Security Requirements

- Bearer token must be read from `PROCEDURE_FEEDBACK_API_TOKEN`.
- Token comparison must avoid ordinary string equality.
- API must fail closed when token is absent.
- CORS may allow the `authorization` header, but public GitHub Pages must not contain or inject the token.
- Request body remains bounded by the existing JSON body limit.
- SQL must be parameterized.
- Invalid payloads return stable `400` error codes.
- Write rate limit returns `429 feedback_rate_limited`.

## Privacy and Governance

- Feedback is product signal, not municipal evidence.
- Do not store personal data, secrets, private case details, or reserved municipal information.
- `external reference` feedback remains comparative and must be validated against official Antigua documents and applicable national legislation.
- The API does not automatically update the corpus, workflow templates, or legal conclusions.

## Non-goals

- No browser-embedded API token.
- No public anonymous submission.
- No user accounts or RBAC.
- No dashboard migration to remote mode yet.
- No DELETE endpoint.
- No automated training or corpus mutation.
