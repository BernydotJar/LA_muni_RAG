# Decision 072 — Dedicated public query gateway v1

Date: 2026-07-22
Status: accepted and implemented on a feature branch; deployment pending

## Decision

Implement `POST /api/public/v1/query` as a separate browser boundary rather than
re-enabling legacy `/api/chat` or exposing authenticated tenant APIs.

The gateway:

- binds tenant and jurisdiction server-side;
- accepts only keyword/phrase query input;
- rejects Authorization, Cookie, tenant and credential fields;
- uses exact Origin allowlists;
- applies global and HMAC per-client database rate buckets;
- reuses current public evidence eligibility and forced RLS;
- returns bounded deterministic evidence/no-evidence output;
- records minimized audit metadata;
- remains disabled by default.

## Rationale

The public browser cannot safely hold an integration credential. The existing
Search API is tenant-scoped and intended for authenticated clients. A distinct
boundary prevents public input from selecting tenants or authority state and
provides a place for browser-origin and abuse controls.

Anonymous semantic/hybrid modes are excluded to avoid unapproved provider cost
and latency. They may be reconsidered only after real-corpus quality, budgets,
quotas, caching and abuse evidence exist.

## Consequences

- Pages may eventually target this route through `PAGES_API_URL`.
- Route implementation does not authorize enabling it without a real reviewed
  public corpus.
- Database rate controls supplement rather than replace edge/WAF controls.
- Legacy `/api/chat` stays development-only and production-disabled.
- GCP resource creation, DNS, secrets and deployment remain human-gated.
