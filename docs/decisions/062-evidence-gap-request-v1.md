# Decision 062 — Separate immutable EvidenceGapRequest intake

Date: 2026-07-21
Status: accepted for feature implementation

## Decision

Implement EvidenceGapRequest as a dedicated authenticated route, aggregate and
replay namespace. Do not reuse ProcedureQuery or ClaimPack persistence and do
not invoke the RAG compiler during intake.

The aggregate is immutable and initially `open`; echoed requester text is always labeled `requester_supplied_unverified`. OS Electoral supplies an opaque
campaign reference and documentary need; LA Muni RAG owns validation, authority
and any future resolution. Intake never promotes a source.

## Rationale

- transport idempotency and domain identity have different conflict semantics;
- an unresolved research request is not an EvidenceBundle or ClaimPack;
- compiler execution would add cost and create false expectations of resolution;
- dedicated FORCE RLS state avoids cross-operation key collisions;
- immutable intake preserves auditability without granting aggregate mutation to
  the runtime role;
- canonical replay validation prevents schema-valid semantic tampering.

## Consequences

- a future resolution workflow needs a separate append-only status/event design;
- retention of documentary request text requires human Privacy/Legal approval;
- the external OS Electoral consumer remains necessary for interoperability;
- deployment remains human-gated.
