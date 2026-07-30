# Feature 067 implementation plan

## Producer

1. Add migration 014 with tenant-owned sources, document-source binding, confidentiality, catalog request replay, rate state and minimum runtime grants.
2. Add catalog repository abstractions with in-memory and PostgreSQL implementations.
3. Add strict types, validators and HTTP handler for the six routes.
4. Wire routes before the production legacy-API gate.
5. Add schemas, examples and OpenAPI operations.
6. Add focused unit/HTTP/migration/eval tests.
7. Add PostgreSQL SQL gate and compiled HTTP smoke.

## Critic

Review for:

- caller-controlled authority or lifecycle promotion;
- cross-tenant existence or count leakage;
- cursor tampering and unbounded filters;
- replay corruption or byte-order drift;
- private object, scan, lease, fencing, pipeline or raw error exposure;
- audit growth and narrative leakage;
- use of owner/BYPASSRLS roles in evidence;
- mismatch between OpenAPI and server routing.

## Fixer

Resolve every critical/high code finding and add a regression before versioning.

## Independent verifier

Use a detached checkout, clean lockfile install, focused gates, full suite, contracts, typecheck/build, PostgreSQL non-owner SQL gate and compiled HTTP smoke. Verify remote SHA and CI independently after publication.

## Checkpoint boundary

This slice completes the catalog foundation routes only. `POST /api/v1/search` and `POST /api/v1/evidence-bundles` are the next independent retrieval slice and must not be credited here.
