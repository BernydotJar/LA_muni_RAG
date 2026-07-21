# Evaluation harness

## Purpose

The evaluation harness protects LA Muni RAG's evidence-and-procedure boundary. An evaluation passes only when the generated artifact is structured, attributable, tenant-safe where applicable, explicit about missing evidence, and free of capabilities owned by OS Electoral or the Content Agency.

A green synthetic evaluation is not evidence that the municipal corpus is complete, that a workflow is officially approved, or that the platform is production-ready.

## Commands

```bash
npm run domain:evaluate
npm run eval:procedure
npm run eval:boundary
npm run eval:mixco
npm run eval:water
npm test
```

`npm run eval:procedure`, `npm run eval:boundary`, `npm run eval:mixco`, and `npm run eval:water` are named CI gates. The complete regression remains `npm test`.

## EVAL-PROCEDURE-001

Input:

```text
¿Cuál es el procedimiento para realizar X?
```

Implemented acceptance criteria:

1. The literal placeholder query is recognized as procedural but remains `unknown`; the compiler does not invent what `X` means.
2. Retrieval queries are normalized and deduplicated while retaining the original question and a generic municipal-procedure research query.
3. Without evidence, the compiler emits a three-step research workflow with two dependencies, required and output documents, `insufficient` evidence states, empty citations, and explicit blocking gaps.
4. The no-evidence v1 artifact validates against `ProcedureWorkflow`, remains an AI `draft`, and marks each step `missing_evidence` with `Documento o regla pendiente de localizar y validar.`
5. With controlled, identity-bound municipal evidence, three distinct sources support exactly one matching step each; citations are not promoted across steps.
6. The evidence-backed v1 artifact contains three official-target sources, three section-level citations, three supported steps, two dependencies, and no unresolved synthetic gaps.
7. Actor, unit, system, deadline, approval, and other operational assignments remain null or empty unless the evidence explicitly supplies them.
8. The JSON round trip is stable and the artifact contains no electoral-strategy or content-production capability.

Executable evidence:

- `src/__tests__/eval-procedure-001.test.ts`
- `src/procedure/procedureClassifier.ts`
- `src/procedure/procedureComposer.ts`
- `src/api/v1/mapper.ts`
- `contracts/schemas/v1/procedure-workflow.schema.json`

Current limitations:

- The supporting records are controlled synthetic fixtures. They prove identity binding, authority mapping, citation selectivity, and schema behavior, not the completeness or current legal effect of the Antigua corpus.
- `X` intentionally remains unclassified until the subject and governing evidence are identified.
- The evaluation does not prove production retrieval thresholds, contradiction handling, persistent procedure versions, human review/approval, or procedure-case tracking.
- A valid `draft` workflow is not an executable instruction and does not authorize municipal action.

Therefore `EVAL-PROCEDURE-001` is `passed_with_corpus_and_lifecycle_limitations`, while the parent procedure workstream and production gate remain open.

## EVAL-BOUNDARY-001

Primary input:

```text
Diseña la estrategia electoral y el calendario de contenido.
```

Implemented acceptance criteria:

1. A request that combines electoral strategy and a content calendar is rejected before the procedure compiler runs.
2. The contract-valid `product_boundary_violation` error names both downstream owners while routing the primary electoral violation to OS Electoral.
3. A content-only editorial-calendar and social-publication request is routed to Content Agency and never reaches the compiler.
4. Boundary inspection covers the question, facts, and constraints so an out-of-scope instruction cannot be hidden in case context.
5. Rejections return no workflow, sources, citations, claims, or content artifacts.
6. The audit event is `integration.procedure_query.boundary_rejected`, records only the allowlisted reason code, and does not retain the raw question, facts, or constraints.
7. A legitimate evidence-and-procedure request reaches the compiler exactly once and returns only a schema-valid `draft` workflow with `product_boundary=evidence_and_procedure_only`.
8. The accepted artifact contains no campaign strategy, electoral segments, content calendar, publication tasks, paid media, or social-publication capability.

Executable evidence:

- `src/__tests__/eval-boundary-001.test.ts`
- `src/__tests__/helpers/procedure-query-v1-harness.ts`
- `src/api/v1/boundary.ts`
- `src/api/v1/handler.ts`
- `contracts/schemas/v1/api-error.schema.json`
- `contracts/schemas/v1/procedure-workflow.schema.json`

Current limitations:

- This hard eval covers the implemented `POST /api/v1/procedure-queries` provider. Every future endpoint and external consumer must preserve the same product boundary.
- Pattern detection is a deterministic policy gate, not a complete semantic classifier; adversarial language review remains necessary as the API catalog grows.
- The test harness uses controlled in-memory identity, persistence, and compiler dependencies and does not prove a deployed cross-product topology.

Therefore `EVAL-BOUNDARY-001` is `passed_for_current_provider_surface`, while program-wide boundary assurance remains open for future APIs and external consumers.

## EVAL-MIXCO-001

Input:

```text
Usa el manual de Mixco para explicar contratación de obra
```

Implemented acceptance criteria:

1. The query is procedural, classifies as `procurement`, and identifies `Mixco` as an external municipality.
2. The controlled source is official for Mixco but is classified `external_reference`/`comparative`; it is never local or official for Antigua Guatemala.
3. The internal workflow jurisdiction is `external reference`, confidence remains low, and only the matching `Definir modalidad` step receives the comparative citation.
4. The workflow retains a blocking gap for an official Antigua source and an important gap for validation against Antigua documents and applicable national law.
5. The v1 artifact validates as an AI `draft`, reports top-level authority `comparative`, and emits the exact warning: `Referencia comparativa de la Municipalidad de Mixco. No define por sí sola el procedimiento oficial de Antigua Guatemala.`
6. Source metadata states `municipality=mixco`, `official_source=true`, `official_for_target_jurisdiction=false`, and distinguishes source from target jurisdiction.
7. The Mixco-backed step is `comparative_reference`; unsupported steps remain `missing_evidence`, and actors, units, systems, and deadlines remain null.
8. The canonical schema rejects both silent promotion to `official_target_jurisdiction` and replacement of the mandatory warning with a generic label.

Executable evidence:

- `src/__tests__/eval-mixco-001.test.ts`
- `src/procedure/procedureAuthorities.ts`
- `src/procedure/procedureComposer.ts`
- `src/api/v1/mapper.ts`
- `contracts/schemas/v1/common.schema.json`
- `contracts/schemas/v1/procedure-workflow.schema.json`

Current limitations:

- The Mixco record is a controlled synthetic fixture. It proves authority mapping and contract behavior, not acquisition, clean scanning, ingestion, current validity, or completeness of the real Mixco corpus.
- No Mixco procedure is promoted to Antigua, and the evaluation does not prove that a corroborating Antigua source has been located.
- The evaluation does not prove production retrieval thresholds, conflict handling, lifecycle, human approval, or procedure-case tracking.

Therefore `EVAL-MIXCO-001` is `passed_with_corpus_and_corroboration_limitations`.

## EVAL-WATER-001

Input:

```text
¿Qué se necesita para llevar agua potable a una comunidad de Antigua Guatemala y cómo se le da seguimiento?
```

Implemented acceptance criteria:

1. The query is classified as `potable_water_project` before generic public-works or COCODE rules.
2. The compiler emits exactly 47 ordered research categories from community need through service quality.
3. Categories are not treated as facts. With no evidence, every internal step is `insufficient` and every v1 step is `missing_evidence`.
4. Every v1 step satisfies the canonical `ProcedureStep` contract, including explicit null or empty values for unsupported actors, units, systems, approvals, deadlines, citations, and legal bases.
5. Every missing step contains the canonical unknown: `Documento o regla pendiente de localizar y validar.`
6. The generated workflow is an AI `draft`, remains Antigua-first, and contains no campaign strategy or content-production fields.
7. A narrowly matched PDM-OT citation supports only the PDM-OT category; it does not silently promote the other 46 steps.
8. Deep-dive output contains 46 explicit sequential research dependencies so the checklist is exportable as a graph without claiming legal ordering.

Executable evidence:

- `src/__tests__/eval-water-001.test.ts`
- `src/domain/packs/municipal-antigua-water.ts`
- `src/domain/packs/municipal-antigua.ts`
- `src/api/v1/mapper.ts`
- `contracts/schemas/v1/procedure-workflow.schema.json`

Current limitations:

- The test uses controlled synthetic evidence to prove classification, field completeness, evidence downgrading, and citation selectivity.
- It does not prove that all Antigua Guatemala sources have been located, acquired, scanned, ingested, indexed, or validated for current legal effect.
- It does not prove a real end-to-end retrieval threshold, contradiction policy, actor assignment, deadline, external system, approval route, or official step ordering.
- It does not create a persistent procedure version, approval record, or procedure-case instance.
- Mixco remains comparative only and requires separate corroboration for Antigua Guatemala.

Therefore `EVAL-WATER-001` is `passed_with_corpus_and_runtime_limitations`, while the parent WS-05 and production gate remain open.

## Required hard-eval matrix

| Evaluation | Current executable status | Remaining proof |
|---|---|---|
| EVAL-PROCEDURE-001 | passed_with_corpus_and_lifecycle_limitations | Synthetic identity-bound citations and workflow JSON pass; real corpus retrieval, conflicts, lifecycle, approvals, and cases remain open. |
| EVAL-WATER-001 | passed_with_corpus_and_runtime_limitations | Real Antigua corpus, retrieval thresholds, contradictions, approvals, and persistent case tracking. |
| EVAL-MIXCO-001 | passed_with_corpus_and_corroboration_limitations | End-to-end classification, composition, mapping, warning, anti-promotion schema checks, and corroboration gaps pass; real corpus and Antigua corroboration remain open. |
| EVAL-OS-INTEGRATION-001 | partial | Provider contract and boundary exist; external consumer interoperability is not proven. |
| EVAL-CONTENT-INTEGRATION-001 | missing | ClaimPack provider and contract tests are not implemented. |
| EVAL-BOUNDARY-001 | passed_for_current_provider_surface | Mixed and single-owner requests, hidden context violations, non-compilation, safe audit, and allowed evidence/procedure output pass; future APIs and consumers remain in scope. |
| EVAL-TENANT-001 | partial | Procedure-query and ingestion database gates exist; the full API catalog and production topology remain open. |
| EVAL-CONFLICT-001 | missing | Conflicting versions, review, and non-silent promotion are not implemented end to end. |
| EVAL-CORRUPT-001 | partial | Corrupt replay and ingestion failures fail closed; real scanner/object storage and recovery drills remain open. |

## Release rule

No evaluation result authorizes deployment. Production requires all hard evaluations, the full production gate, and explicit human approval.
