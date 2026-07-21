# Decision 061 — ProcedureAssessment is conservative and draft-bound

Status: accepted for the feature branch; PostgreSQL smoke passed; remote CI pending.

## Decision

`requested_output=procedure_assessment` compiles the same tenant-scoped workflow
used by EvidenceBundle and ProcedureWorkflow, then derives a closed v1 assessment.
Caller-owned `provided_documents` are opaque references and never enter
`completed_requirements` without a validated LA Muni RAG document/case binding.
A citation may prove that a requirement exists, but not that the case satisfied
it; such requirements remain `inferred_for_review` or weaker.

The assessment is tied to the generated draft workflow, preserves evidence and
audit provenance, identifies blocked steps/unknowns, and emits one next
documentary action. It preserves only opaque subject/community/document references;
raw narrative `facts` and `constraints` are not copied into the response replay. It does not create a case, approve a procedure, select legal
applicability, or make campaign/content decisions.

## Rejected alternatives

- trusting caller document IDs as completion;
- treating supported requirement existence as case satisfaction;
- creating an implicit case or approval record during a query;
- returning a narrative assessment outside the JSON Schema contract;
- retaining the 503 after the mapper and runtime validators exist.

## Consequences

The provider is useful for documentary triage but intentionally reports zero
completed requirements until a future case/document validation service exists.
Consumers must preserve draft/version/provenance and human-review limitations.
