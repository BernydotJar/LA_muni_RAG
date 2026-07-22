# Feature 069 — Portable consumer contract kit v1

## Goal

Publish deterministic, repository-independent contract manifests for OS Electoral and Content Agency. A consumer can pin and copy the declared JSON Schemas, examples and manifests without importing LA Muni RAG runtime code or accessing its database. The repository CLI is provider-side; each external consumer must run an equivalent verifier in its own pipeline.

## Non-goals

- No modifications to OS Electoral or Content Agency repositories.
- No network calls to consumers.
- No production credentials, deployment, publication or distributed transaction.
- No campaign strategy, content generation, source-authority promotion or legal decision.

## Required artifacts

- `contracts/consumer-kits/v1/os-electoral.json`
- `contracts/consumer-kits/v1/content-agency.json`
- CLI verification command that validates manifest closure against OpenAPI, schemas and examples.
- Executable tests and CI gate.

## Manifest invariants

Each manifest is closed and declares:

- consumer and provider product identities;
- exact API version and OpenAPI document;
- interactions with method/path, required request/response headers, success statuses, request schema/example and response schema/example;
- stable error statuses and canonical API error schema/examples;
- forbidden response fields owned by another product;
- preservation rules for tenant, request, provenance, citations, limitations and replay;
- explicit limitations that provider verification is not cross-repository interoperability proof.

The verifier must fail when:

- a declared path/method is absent from OpenAPI;
- a required header/status/schema reference diverges from OpenAPI;
- a schema/example file is missing or invalid;
- a canonical example violates its schema;
- a forbidden field exists in the response example;
- identities, versions or interaction names are duplicated or malformed.
