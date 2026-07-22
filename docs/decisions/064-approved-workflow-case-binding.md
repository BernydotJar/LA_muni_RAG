# ADR 064 — Cases bind only to an approved immutable workflow version

Status: accepted for v1

## Decision

A new procedure case must reference one tenant workflow version whose lifecycle
status is `approved` at insertion. The case stores and freezes both workflow ID
and version number. Superseding a workflow does not mutate an existing case.

Creation also stores a canonical request hash and a sealed exact initial response.
This makes aggregate identity independent from transport idempotency keys.

## Consequences

- drafts, in-review, superseded and archived workflows cannot seed new cases;
- historical cases remain reproducible against their original version;
- a correction requires a new case or a future explicit migration workflow;
- approval remains governance evidence, not proof that the workflow applies to
  every fact of a particular case;
- database rollback is forward-only after real case data exists.
