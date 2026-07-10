# Procedure Feedback Backend API

## Purpose

Feature 041 adds authenticated PostgreSQL persistence for `ProcedureWorkflow` feedback. The API is intended for controlled internal use. Public GitHub Pages continues to use local-only feedback because no secret is embedded in browser assets.

## Migration

Apply:

```bash
psql "$DATABASE_URL" -f db/migrations/002_procedure_feedback.sql
```

The migration creates:

```text
agent.procedure_feedback
```

Records expire from normal API reads after 180 days through `retention_until`. A later maintenance job may delete expired rows physically.

## Configuration

Set a long random secret:

```text
PROCEDURE_FEEDBACK_API_TOKEN=<long-random-secret>
```

If the value is absent or blank, the API fails closed with HTTP `503` and `feedback_api_disabled`.

Do not place this value in:

- `public/` files;
- GitHub Pages configuration;
- query strings;
- screenshots;
- logs;
- feedback comments.

## Authentication

Both routes require:

```http
Authorization: Bearer <PROCEDURE_FEEDBACK_API_TOKEN>
```

Invalid or missing credentials return HTTP `401` with `feedback_unauthorized`.

## Create feedback

```http
POST /api/procedure-feedback
Content-Type: application/json
Authorization: Bearer <token>
```

Example body:

```json
{
  "workflowId": "procedure:school-closure",
  "workflowTitle": "Flujo de cierre de obra municipal",
  "procedureType": "project_closure",
  "jurisdiction": "Antigua Guatemala",
  "confidence": "medium",
  "query": "¿Qué falta para cerrar la obra de la escuela?",
  "stepNumber": "2",
  "stepTitle": "Confirmar recepción física o técnica",
  "feedbackType": "missing_document",
  "comment": "Falta acta de recepción final para confirmar el cierre."
}
```

Successful response:

```json
{
  "item": {
    "id": "...",
    "workflowId": "procedure:school-closure",
    "isExternalReference": false,
    "createdAt": "...",
    "retentionUntil": "..."
  }
}
```

## List feedback

```http
GET /api/procedure-feedback?limit=50&feedbackType=missing_document&workflowId=procedure%3Aschool-closure
Authorization: Bearer <token>
```

Response:

```json
{
  "items": [],
  "total": 0
}
```

## Validation

The API accepts only known:

- procedure types;
- jurisdictions;
- confidence values;
- feedback types.

Text fields are normalized, trimmed, stripped of disallowed control characters, and length-bounded. SQL queries are parameterized.

## Rate limiting

POST requests are limited to 20 submissions per 10-minute window per direct socket address. Forwarded headers are not trusted in this MVP. The address is used only in memory and is not persisted.

## Privacy and governance

The database does not store:

- IP address;
- user-agent;
- cookies;
- authorization token;
- request headers.

Feedback remains product signal, not municipal evidence. A record marked `external reference` is comparative only and must be validated against official Antigua documents and applicable national legislation.

## Verification

```bash
npm run typecheck
npm run build
npm run test
```

For database verification, apply the migration before running integration tests against a configured local database.
