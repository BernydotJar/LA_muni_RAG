# 061 — Conservative ProcedureAssessment Provider v1

Status: implemented and verified locally with PostgreSQL; remote CI pending

## Objective

Implement `requested_output=procedure_assessment` on
`POST /api/v1/procedure-queries` by deriving a contract-valid documentary
assessment from the same tenant-scoped compilation used by EvidenceBundle and
ProcedureWorkflow.

## Product boundary

The assessment belongs to LA Muni RAG because it evaluates documentary
requirements, evidence state, blocked procedural steps, unknowns, and the next
documentary action. It does not decide campaign strategy, project feasibility,
legal compliance, budget approval, procurement approval, institutional closure,
or content production.

## Conservative completion policy

- `case_context.provided_documents` contains caller-owned opaque references.
  Without a validated tenant document binding, they never enter
  `completed_requirements`.
- A citation may support that a requirement exists, but does not prove that the
  case has satisfied it. Such document requirements remain
  `inferred_for_review` or weaker.
- A step is blocked when its documentary evidence is not `supported` or it has
  any required document that has not been validated for the case.
- Version conflicts, comparative sources, inference, and missing evidence never
  become completed requirements.
- The generated assessment is tied to a draft workflow and requires human
  review. It is not a persistent procedure case.

## Acceptance criteria

1. Authentication, rate limit, RBAC, tenant and credential binding happen in the
   existing proven order.
2. Assessment success uses the existing scoped compiler, idempotency state,
   exact replay, audit, and response-size boundary.
3. The output validates against `procedure-assessment.schema.json`.
4. `procedure_id`, workflow version, tenant, request, case context, evidence
   refs, limitations, credential and audit provenance remain identity-bound.
5. Opaque provided-document references cannot create completed requirements.
6. Supported requirement evidence is downgraded to case review, not completion.
7. Missing or conflicting evidence yields blocked steps, explicit unknowns and a
   bounded next documentary action.
8. Stored replay is schema-validated before emission and corrupt replay follows
   the existing invalidate-and-retry path.
9. OpenAPI, compiled PostgreSQL HTTP smoke, integration docs and named eval are
   current.
10. No OS Electoral or Content Agency source-of-truth field is returned.

## Test plan

- pure mapper tests for no-evidence and cited-evidence workflows;
- adversarial HTTP tests for exact replay, request conflict, tenant/credential
  binding, response validation and audit;
- OS integration eval update from honest 503 to conservative 200;
- compiled PostgreSQL smoke for success and replay;
- full contract and global regression.

## Rollback

The change is application/contract wiring only. Rollback restores the explicit
503 branch and removes the mapper/OpenAPI response variant. It does not alter
stored procedure-query idempotency or audit schema.


## Completed tasks

- [x] conservative mapper and explicit third handler branch;
- [x] output-specific request/replay validation;
- [x] opaque-document and cited-requirement monotonicity tests;
- [x] exact replay and corrupt-replay invalidation tests;
- [x] OpenAPI three-variant response and strict contract validation;
- [x] PostgreSQL non-owner gates and compiled ProcedureQuery/ClaimPack/lifecycle smokes;
- [x] named eval, CI wiring, ADR, risk and traceability documentation;
- [ ] detached clean-checkout regression;
- [ ] remote Backend CI on the published commit;
- [ ] external OS Electoral consumer contract;
- [ ] human protected merge/deployment approval.
