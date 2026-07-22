# Feature 072 — Public Query Gateway v1

Status: RED tests pending implementation.

## Goal

Expose one safe browser query boundary at `POST /api/public/v1/query` without
reusing legacy `/api/chat`, accepting tenant identity from the browser, or
placing an integration credential in frontend code.

## Contract

Request body:

```json
{
  "message": "consulta municipal",
  "mode": "keyword",
  "limit": 5
}
```

Only `keyword` and `phrase` are accepted in v1. Tenant, jurisdiction, as-of date,
filters and database principal are server configuration.

The response preserves the widget-compatible `role`, `content`, `citations` and
`meta` fields, plus schema/request identity and explicit limitations. It never
returns tenant, credential, principal, object, scanner, lease or audit identity.

## Security requirements

1. Disabled or incomplete configuration returns bounded 503.
2. A request Origin is required and must match the exact reviewed allowlist.
3. OPTIONS exposes only POST, content-type and x-request-id.
4. The handler rejects method/content-type/body/schema failures before database search.
5. Body is closed and bounded; query control characters are rejected.
6. Client rate identity is an HMAC of connection metadata using a runtime secret;
   raw IP and user-agent are never persisted or audited.
7. Global and per-client database-backed rate buckets execute before retrieval.
8. The tenant transaction is set server-side and forced RLS remains authoritative.
9. Only public, active, processed, exact accepted/clean evidence may be returned.
10. Signed, credentialed, non-HTTP(S), oversized or control-character source data
    cannot appear in the public response.
11. Comparative or validation-required references never produce a supported answer.
12. Query text, excerpt text, source URLs, IP and user-agent are excluded from audit.
13. Dependency failures use safe 500/503 contracts and `cache-control: no-store`.
14. Legacy `/api/chat` remains production-disabled.

## Operations requirements

- Per-client and global limits are configurable within bounded ranges.
- Cloud Armor/edge rate controls remain required for production.
- The gateway is disabled by default.
- Enabling requires public tenant UUID, jurisdiction, exact origins and HMAC secret.
- This feature creates no GCP resource and does not configure Pages automatically.

## Non-goals

- semantic/hybrid anonymous queries;
- human login/session;
- corpus acquisition;
- procedure-generation gateway;
- cloud provisioning or production deployment.
