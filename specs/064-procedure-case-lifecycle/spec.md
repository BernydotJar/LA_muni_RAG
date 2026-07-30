# Feature 064 — Tenant procedure case lifecycle v1

Status: implemented; local unit, contract, SQL and compiled HTTP verification passed; detached and remote verification pending

## Objective

Create the first server-side system of record for operational municipal procedure
cases. A case must bind immutably to a workflow version that was approved before
case creation and must preserve steps, document references, blockers, follow-up,
documentary validation state and append-only audit.

## Boundaries

A case is operational tracking. It is not a legal conclusion and cannot prove:

- legal compliance;
- municipal approval;
- budget availability;
- procurement validity;
- work reception or liquidation;
- payment;
- institutional closure.

The API does not ingest document bytes, issue signed URLs, compile a workflow,
or make electoral/content decisions.

## API

```text
POST  /api/v1/procedure-cases
GET   /api/v1/procedure-cases/:case_id
PATCH /api/v1/procedure-cases/:case_id
```

## Acceptance criteria

1. Authentication and coarse authorization complete before request-body parsing.
2. Case creation requires `case:write`, exact tenant/credential binding and an
   approved workflow version.
3. Workflow identity, version, jurisdiction, case identity and creation request
   hash are immutable.
4. Canonical create requests converge across transport keys and concurrent calls
   on one case and one exact initial acknowledgement.
5. Transport replay and aggregate replay are hash-verified.
6. Steps use bounded operational states and expected-revision concurrency.
7. Received/reviewed document states require a real tenant document-version ID.
8. Blockers, follow-up, notes and closure are bounded and audited.
9. Documentary validation state changes require `procedure:review`; ordinary
   case operations require `case:write`.
10. Case events are append-only and audit details do not persist raw notes or
    blocker descriptions.
11. All case and transport tables use tenant-leading keys and forced RLS.
12. Runtime gates execute under a non-owner `NOSUPERUSER/NOBYPASSRLS` role.
13. OpenAPI, request/response schemas and examples pass the registry gate.
14. Responses state that operational tracking is not legal or institutional status.

## Remaining production gates

- authenticated human OIDC/session/BFF and tenant provisioning;
- approved privacy purpose, retention, deletion and legal-hold policy for case text;
- object-store/source-viewer integration for dossier documents;
- browser case UI and human accessibility review;
- production topology, backup/restore, load, observability and staging;
- human legal and release review.
