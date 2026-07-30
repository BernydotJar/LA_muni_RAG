# Public Query Gateway API v1

Status: implemented and disabled by default; production deployment and real
public corpus remain unproved.

## Route

```http
POST /api/public/v1/query
```

The route is the only approved browser query boundary. It does not accept or
require a Bearer credential, tenant id, principal id, credential id, jurisdiction
or authority claim from the browser.

## Request

```json
{
  "message": "¿Qué requisitos documentales se publican para una solicitud de agua?",
  "mode": "keyword",
  "limit": 5
}
```

Only `keyword` and `phrase` are supported. Anonymous semantic/hybrid requests are
not part of v1 because provider cost and abuse controls have not been approved.

## Server configuration

The route is disabled unless all required values are valid:

```env
PUBLIC_QUERY_ENABLED=true
PUBLIC_QUERY_TENANT_ID=<reviewed public tenant UUID>
PUBLIC_QUERY_JURISDICTION=Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala
PUBLIC_QUERY_ALLOWED_ORIGINS=https://approved-public-origin.example
PUBLIC_QUERY_RATE_LIMIT_SECRET=<32-512 random server-only characters>
PUBLIC_QUERY_RATE_LIMIT=20
PUBLIC_QUERY_GLOBAL_RATE_LIMIT=100
PUBLIC_QUERY_RATE_WINDOW_SECONDS=60
PUBLIC_QUERY_MAX_RESULTS=5
```

Origins are exact scheme/host/port values. HTTPS is required outside localhost.
The HMAC secret never enters Pages, logs, audit rows or responses.

## Response

The response contains:

- deterministic Spanish content;
- bounded public citations;
- `evidence_found`, `insufficient_evidence`, or `not_found` state;
- requested/executed lexical mode;
- configured jurisdiction and as-of date;
- explicit limitations and next action.

It excludes tenant, credential, principal, audit, object, scanner, lease and
pipeline identifiers.

A citation is returned only when its source URL is HTTPS without credentials,
query string or fragment. Comparative or validation-required evidence may remain
visible but never creates a supported answer.

## Security order

1. exact Origin/CORS check;
2. disabled/configuration check;
3. method and request-id validation;
4. global and per-client HMAC rate gates;
5. rejection of Authorization and Cookie headers;
6. JSON/content-type/body/schema validation;
7. server-set tenant transaction and forced RLS;
8. public evidence retrieval and bounded projection;
9. minimized allowlisted audit.

Foreign or missing origins receive 403. Disabled/incomplete configurations with
an approved origin receive 503. Invalid requests receive 400. Rate denial returns
429 and `Retry-After`. Responses use `cache-control: no-store` and `x-content-type-options: nosniff`; only request correlation and retry timing are exposed to browser JavaScript.

## Rate and audit privacy

The database stores SHA-256 HMAC client keys, operation, window and count. It has
no IP, user-agent, query, request-body or source-URL columns. Audits store only
request id, operation, reason, requested mode and result count. Query/excerpt/URL
content and raw network identity are excluded.

Edge controls such as Cloud Armor remain required in production; database rate
limits are not presented as complete DDoS protection. The HMAC client bucket is
a supplemental connection fingerprint and may collapse behind a reverse proxy;
the global bucket remains authoritative until trusted edge identity is configured.

## Evidence eligibility

The gateway reuses the SearchEvidence repository. Eligible evidence must be:

- source acquired, ingested and indexed;
- document active and public;
- document version processed;
- exact artifact accepted and unexpired;
- accepted scan clean and generation/hash/media-type consistent;
- ingestion job processed;
- visible under the server-configured tenant RLS context.

This implementation does not prove that any real corpus satisfies those states.

## Operations and limitations

- legacy `/api/chat` remains production-disabled;
- the gateway is enabled only after a reviewed public corpus exists;
- Pages `PAGES_API_URL` must not be configured before staging approval;
- Cloud Armor, load, observability, human source review, privacy operations,
  deployment and observation remain open;
- passing repository gates is not production readiness.
