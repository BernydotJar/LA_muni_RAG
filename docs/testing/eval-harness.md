# Evaluation harness

## Purpose

The evaluation harness protects LA Muni RAG's evidence-and-procedure boundary. An evaluation passes only when the generated artifact is structured, attributable, tenant-safe where applicable, explicit about missing evidence, and free of capabilities owned by OS Electoral or the Content Agency.

A green synthetic evaluation is not evidence that the municipal corpus is complete, that a workflow is officially approved, or that the platform is production-ready.

## Commands

```bash
npm run domain:evaluate
npm run eval:procedure
npm run eval:os-integration
npm run eval:content-integration
npm run eval:conflict
npm run eval:boundary
npm run eval:corrupt
npm run eval:tenant
npm run eval:mixco
npm run eval:water
npm test
```

`npm run eval:procedure`, `npm run eval:os-integration`, `npm run eval:content-integration`, `npm run eval:conflict`, `npm run eval:boundary`, `npm run eval:corrupt`, `npm run eval:tenant`, `npm run eval:mixco`, and `npm run eval:water` are named CI gates. The complete regression remains `npm test`.

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

## EVAL-OS-INTEGRATION-001

Primary requests:

```text
OS Electoral -> ProcedureQueryRequest(requested_output=evidence_bundle)
OS Electoral -> ProcedureQueryRequest(requested_output=procedure_workflow)
```

Implemented acceptance criteria:

1. The provider accepts the canonical OS Electoral request envelope without importing campaign data ownership or consulting an OS Electoral database.
2. `requested_output=evidence_bundle` returns a schema-valid bundle from the same internal compilation used by the workflow provider.
3. Official Antigua evidence preserves document, version, section, source authority, citation identity, and one evidence-backed claim; an evidence-free result returns empty claims and explicit missing evidence.
4. An official citation marked `inference` remains `inferred_for_review`; a citation marked `validation_required` is never promoted to a claim and creates an explicit step gap.
5. The EvidenceBundle is byte-exact on idempotent replay, carries the exact allowed OS origin in CORS, and records only allowlisted audit classifications.
6. `requested_output=procedure_workflow` returns a schema-valid `workflow_version=1.0.0`, `approval_status=draft` artifact with sources, citations, and steps.
7. Neither output contains campaign strategy, electoral segments, territories, message house, approved message, content calendar, publication tasks, or media spend fields.
8. `requested_output=procedure_assessment` remains an honest non-retryable `503 capability_unavailable` and never invokes the compiler.
9. OpenAPI 3.1.1 exposes exactly the implemented 200 variants, and the compiled PostgreSQL/HTTP smoke passed locally against PostgreSQL 15.18/pgvector 0.8.5 with EvidenceBundle success, exact replay, and exact-origin CORS.

Executable evidence:

- `src/__tests__/eval-os-integration-001.test.ts`
- `src/api/v1/mapper.ts`
- `src/api/v1/handler.ts`
- `src/api/v1/contracts.ts`
- `contracts/schemas/v1/evidence-bundle.schema.json`
- `contracts/schemas/v1/procedure-workflow.schema.json`
- `contracts/openapi/v1/openapi.json`
- `scripts/procedure-query-postgres-smoke.mjs`

Current limitations:

- The focused provider test uses controlled identity-bound Antigua evidence. It proves contract mapping, CORS, idempotency, audit minimization, and product boundaries, not a complete or current municipal corpus.
- The compiled PostgreSQL/HTTP smoke and non-owner SQL gate passed locally on the current tree; remote CI on the published commit remains pending.
- No consumer contract test has run inside the OS Electoral repository, so cross-repository interoperability, consumer persistence, and consumer-side draft/comparative handling remain unproved.
- `ProcedureAssessment`, the external consumer, lifecycle UI/accessibility, and distributed production topology remain unavailable or unproved. Governed lifecycle persistence and human approval APIs now exist as a separate verified slice.

Therefore `EVAL-OS-INTEGRATION-001` is `passed_for_workflow_and_evidence_bundle_provider_with_assessment_and_external_consumer_limitations`.

## EVAL-CONTENT-INTEGRATION-001

Primary request:

```text
Content Agency -> ClaimPackRequest(question, jurisdiction, case_context)
```

Implemented acceptance criteria:

1. `POST /api/v1/claim-packs` accepts only the dedicated closed Content Agency request; OS Electoral campaign/community fields, briefs, channels, copy, and unknown fields are rejected.
2. Authentication completes before request-body parsing; authorization, tenant identity, credential provenance, CORS, rate limiting, and idempotency are enforced server-side.
3. Official Antigua evidence produces a schema-valid pack with claims, citations, paraphrase limits, disclaimer, validity bound, and source links.
4. The provider does not generate copy, assets, channels, publication tasks, or campaign strategy.
5. Exact replay returns byte-identical output; changed input with the same key returns a non-leaking conflict; corrupt/expired stored output is invalidated before emission.
6. No citable source, inferred evidence, or `validation_required` evidence returns `409 insufficient_evidence` without a ClaimPack.
7. Mixco remains `comparative_reference` and carries the canonical warning; it is never promoted to official Antigua evidence.
8. Missing role, cross-tenant scope, mismatched credential provenance, content generation, and electoral strategy return uniform `403 forbidden`; detailed ownership classification remains audit-only.
9. Migration 008 creates separate forced-RLS idempotency/rate tables and a sanitized pre-tenant authentication sink; no Bearer token, request body, brief, copy, or publication artifact is stored.
10. OpenAPI 3.1.1, the non-owner SQL gate, and the compiled HTTP smoke passed locally against PostgreSQL 15.18/pgvector 0.8.5 and remain wired as required remote-CI evidence.

Executable evidence:

- `src/__tests__/eval-content-integration-001.test.ts`
- `src/__tests__/claim-pack-runtime-migration.test.ts`
- `src/api/v1/claimPackHandler.ts`
- `src/api/v1/claimPackPersistence.ts`
- `contracts/schemas/v1/claim-pack-request.schema.json`
- `contracts/schemas/v1/claim-pack.schema.json`
- `contracts/openapi/v1/openapi.json`
- `db/migrations/008_claim_pack_api.sql`
- `db/tests/claim_pack_runtime_gate.sql`
- `scripts/claim-pack-postgres-smoke.mjs`

Current limitations:

- Focused provider tests use controlled identity-bound evidence and do not prove corpus completeness or current legal effect.
- Docker-in-Docker could not register the pinned image layers, so the local gate used PostgreSQL 15.18 plus pgvector 0.8.5 built from the verified official v0.8.5 commit. SQL and compiled HTTP smokes passed; remote CI still uses the pinned PostgreSQL 16/pgvector service.
- No consumer contract has run inside the Content Agency repository, so downstream ID/evidence preservation, Greenlight handling, and expiry/supersession behavior remain unproved.
- `valid_until` is a bounded reuse control, not a legal-validity determination, and cross-product revocation remains pending.

Therefore `EVAL-CONTENT-INTEGRATION-001` is `passed_for_claim_pack_provider_with_external_consumer_and_remote_ci_limitations`.

## EVAL-CONFLICT-001

Primary fixture:

```text
same document + same citation slot + distinct document versions + different cited text
```

Implemented acceptance criteria:

1. Conflict detection is documentary and deterministic: it groups only the same `document_id`, normalized citation label, and page; it requires at least two distinct `document_version_id` values and different cited text.
2. It does not infer semantic opposition. The response says explicitly that text differs across versions and human review is required.
3. `EvidenceBundle` emits one `inferred_for_review` position per conflicting version and one schema-valid `Contradiction` whose `claim_refs` point to those positions and whose `review_required` is `true`.
4. The affected workflow step is downgraded to `inferred_for_review`, remains in an AI `draft`, gains a blocking gap, risks, unknowns, and a documentary next action.
5. No version is promoted silently because source authority remains separate from evidence sufficiency.
6. ClaimPack abstains while any review-required contradiction exists, including mixed workflows that also contain an unrelated supported step.
7. Same cited text across versions, different excerpts inside one version, and different documents with the same label do not create false conflicts.
8. The next documentary action requires publication/effective-date, authority, and supersession comparison plus explicit human approval of the applicable version.

Executable evidence:

- `src/__tests__/eval-conflict-001.test.ts`
- `src/api/v1/mapper.ts`
- `contracts/schemas/v1/common.schema.json#/$defs/Contradiction`
- `contracts/schemas/v1/evidence-bundle.schema.json`

Current limitations:

- This is explicit version-text divergence, not semantic contradiction detection across unrelated documents or legal interpretations.
- `document_versions` still lacks a complete effective/supersession decision service; the eval exposes a gap but does not resolve it.
- The current corpus has no approved conflicting Antigua fixture, so the hard eval uses identity-bound synthetic public evidence.
- Conflict review/approval is not persisted as a workflow lifecycle event yet.

Therefore `EVAL-CONFLICT-001` is `passed_for_explicit_version_text_conflicts_with_lifecycle_and_corpus_limitations`.

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

## EVAL-CORRUPT-001

Primary conditions:

```text
A completed idempotency record contains an invalid stored response.
A first compilation attempt fails before the workflow is completed.
A malformed or text-free document reaches the controlled ingestion surface.
```

Implemented acceptance criteria:

1. A corrupt stored replay is schema-validated before emission, invalidated on failure, and replaced with a contract-valid retryable `500 internal_error`.
2. Corrupt stored bytes and their secret marker never appear in the HTTP response or audit records, and the procedure compiler is not invoked for the invalid replay.
3. Reusing the same idempotency key after invalidation performs one trusted compilation, stores a valid draft workflow, and then replays the exact trusted bytes without recompiling.
4. A compilation exception produces a stable retryable internal error, records only `execution_failed`, releases the processing reservation, and does not preserve the exception message.
5. Reusing the same key after the failed compilation succeeds, is not reported as conflict or in-progress, and becomes a stable replay.
6. The named gate also runs the existing PDF, tenant-worker, and durable job-service suites.
7. Malformed and text-free PDFs map to stable non-retryable ingestion failures.
8. Stale/mismatched acceptance evidence, byte mutation, invalid media/policy, and lease loss never call completion; provider failures enter the bounded retry path; non-retryable failures update jobs and document versions to `failed`, not `processed`.

Executable evidence:

- `src/__tests__/eval-corrupt-001.test.ts`
- `src/__tests__/ingestion-pdf.test.ts`
- `src/__tests__/ingestion-worker.test.ts`
- `src/__tests__/ingestion-job-service.test.ts`
- `src/api/v1/handler.ts`
- `src/api/v1/persistence.ts`
- `src/ingestion/ingestionWorker.ts`
- `src/ingestion/ingestionJobService.ts`

Current limitations:

- Procedure replay tests use controlled in-memory persistence; PostgreSQL invalidation and rollback remain covered by disposable runtime gates rather than this focused harness.
- Ingestion tests use controlled artifact, scanner-evidence, provider, and transaction adapters. They do not prove a deployed malware scanner, durable object store, worker dispatcher, load behavior, or disaster recovery.
- The disposable PostgreSQL gates now execute locally, including corrupt workflow replay invalidation and recovery. Remote CI and publication evidence remain separate requirements.

Therefore `EVAL-CORRUPT-001` is `passed_for_current_replay_and_ingestion_failure_surfaces_with_storage_limitations`.

## EVAL-TENANT-001

Primary condition:

```text
A credential authenticated for tenant A submits a procedure query whose tenant_id is tenant B.
```

Implemented acceptance criteria:

1. Cross-tenant denial and missing-role denial return the same contract-valid `403 forbidden` shape with empty details.
2. The response is scoped to the authenticated tenant and contains neither the requested tenant identifier nor a tenant-existence or mismatch explanation.
3. The compiler is not invoked for either denial.
4. Rate-limit and audit work runs only inside transaction-local `app.tenant_id` contexts for the authenticated tenant; no transaction is opened under the requested foreign tenant.
5. The cross-tenant denial produces `integration.procedure_query.tenant_access_denied`, but the audit stores only allowlisted metadata and does not retain foreign-tenant facts, document references, constraints, or secret markers.
6. A valid same-tenant request returns a schema-valid draft workflow and completes its persistence work in transaction-local tenant A contexts.
7. Migration 004 enables and forces RLS on procedure-query idempotency and rate-limit tables.
8. CI now recreates the disposable `la_muni_rag_test` database, runs the non-owner procedure-query RLS gate, and executes the compiled PostgreSQL/HTTP smoke test in addition to the ingestion gates.

Executable evidence:

- `src/__tests__/eval-tenant-001.test.ts`
- `src/__tests__/helpers/procedure-query-v1-harness.ts`
- `db/migrations/004_procedure_query_api.sql`
- `db/tests/procedure_query_runtime_gate.sql`
- `scripts/procedure-query-postgres-smoke.mjs`
- `.github/workflows/ci.yml`

Current limitations:

- The HTTP hard eval uses controlled in-memory persistence and transaction clients; the PostgreSQL gate remains a separate disposable CI control.
- The restored PostgreSQL/HTTP gates passed locally with a non-owner, non-superuser, non-`BYPASSRLS` role. Remote CI on the published commit and production topology remain pending.
- This result covers the implemented procedure-query and historical ingestion surfaces, not every endpoint required by the final API catalog or a production deployment topology.
- Tenant isolation under backup, restore, analytics, observability, object storage, and future procedure-case APIs remains unproved.

Therefore `EVAL-TENANT-001` is `passed_for_current_provider_and_disposable_db_gate_with_topology_limitations`.

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
- The focused water eval itself does not create an approved corpus-backed procedure version or a procedure-case instance. Governed lifecycle persistence is verified separately, but official water-workflow approval still requires real corpus and human review.
- Mixco remains comparative only and requires separate corroboration for Antigua Guatemala.

Therefore `EVAL-WATER-001` is `passed_with_corpus_and_runtime_limitations`, while the parent WS-05 and production gate remain open.

## Governed workflow lifecycle API gate

This is a deterministic production-shaped gate, not a legal-validity declaration.

Implemented acceptance criteria:

1. `POST /api/v1/workflow-drafts`, `POST /api/v1/workflow-reviews`, `POST /api/v1/workflow-approvals`, and `GET /api/v1/workflows/{workflow_version_id}` are authenticated, tenant-scoped, rate-limited, audited, and contract-valid.
2. Authentication and coarse RBAC complete before body parsing; request, tenant, nested workflow, and credential provenance identities are bound server-side.
3. Every generated/imported version starts `draft`; creator, reviewer, and approver remain distinct.
4. Exact idempotent replay returns exact bytes; changed payload conflicts; a concurrent in-progress request cannot lose its claim.
5. Invalid stored replay is committed as invalidated before the handler emits a generic non-leaking error, and the next request can regenerate safely.
6. Missing and cross-tenant workflow identifiers share the same `404` shape without metadata leakage.
7. Supersession atomically approves a reviewed same-procedure replacement, supersedes the former approved version, and leaves exactly one approved row.
8. Forced RLS, non-owner execution, append-only review/approval evidence, approved-content immutability, and pre-tenant authentication aggregation pass the disposable SQL gate.

Executable evidence:

- `src/__tests__/workflow-lifecycle-state-machine.test.ts`
- `src/__tests__/workflow-lifecycle-api-v1.test.ts`
- `src/__tests__/workflow-lifecycle-migration.test.ts`
- `src/__tests__/workflow-lifecycle-api-migration.test.ts`
- `db/migrations/009_workflow_lifecycle.sql`
- `db/migrations/010_workflow_lifecycle_api.sql`
- `db/tests/workflow_lifecycle_runtime_gate.sql`
- `scripts/workflow-lifecycle-postgres-smoke.mjs`
- `contracts/schemas/v1/workflow-*.schema.json`
- `contracts/openapi/v1/openapi.json`

Current local evidence:

- lifecycle-focused tests: 35/35;
- contract registry: 16 schemas, 16 examples, one OpenAPI 3.1.1 document;
- fresh non-owner database path: PostgreSQL 15.18, pgvector 0.8.5, migrations/gates 001–004 + 008–010;
- compiled ProcedureQuery, ClaimPack, and lifecycle HTTP smokes: pass;
- full regression: 636 tests, 634 pass, 0 fail, 2 explicit environment skips.

Remaining limitations:

- remote CI on the published commit, protected merge, and deployment are not yet credited;
- workflow review/approval UI, accessibility, notifications, consumer interoperability, semantic conflict resolution, backup/restore, load/HA, and observability remain open;
- an approved workflow is a governance state, not proof of current legal applicability or institutional execution.

## Required hard-eval matrix

| Evaluation | Current executable status | Remaining proof |
|---|---|---|
| EVAL-PROCEDURE-001 | passed_with_corpus_and_case_limitations | Synthetic identity-bound citations and workflow JSON pass; governed lifecycle is verified separately; real corpus retrieval, conflict resolution, and cases remain open. |
| EVAL-WATER-001 | passed_with_corpus_and_runtime_limitations | Real Antigua corpus, retrieval thresholds, contradictions, approvals, and persistent case tracking. |
| EVAL-MIXCO-001 | passed_with_corpus_and_corroboration_limitations | End-to-end classification, composition, mapping, warning, anti-promotion schema checks, and corroboration gaps pass; real corpus and Antigua corroboration remain open. |
| EVAL-OS-INTEGRATION-001 | passed_for_workflow_and_evidence_bundle_provider_with_assessment_and_external_consumer_limitations | EvidenceBundle and ProcedureWorkflow providers, replay, CORS, authority/citation identity, no-evidence gaps, boundary, OpenAPI, and compiled smoke wiring pass; assessment and OS-repository consumer proof remain open. |
| EVAL-CONTENT-INTEGRATION-001 | passed_for_claim_pack_provider_with_external_consumer_and_remote_ci_limitations | Provider, contract, replay, abstention, RBAC/tenant, Mixco, no-promotion, OpenAPI, non-owner SQL and compiled HTTP smoke pass locally; remote CI and the Content Agency consumer remain open. |
| EVAL-BOUNDARY-001 | passed_for_current_provider_surface | Mixed and single-owner requests, hidden context violations, non-compilation, safe audit, and allowed evidence/procedure output pass; future APIs and consumers remain in scope. |
| EVAL-TENANT-001 | passed_for_current_provider_and_disposable_db_gate_with_topology_limitations | Non-leaking HTTP denial, authenticated-tenant audit, transaction-local context, FORCE-RLS assertions, SQL gates, and compiled smokes pass locally; the full catalog and production topology remain open. |
| EVAL-CONFLICT-001 | passed_for_explicit_version_text_conflicts_with_lifecycle_and_corpus_limitations | 8/8 proves visibility, review_required, downgrade, a blocking gap, ClaimPack abstention, and anti-false-positive behavior; real corpus conflicts, semantic comparison, and persisted resolution lifecycle remain open. |
| EVAL-CORRUPT-001 | passed_for_current_replay_and_ingestion_failure_surfaces_with_storage_limitations | Corrupt replay invalidation, failed-compilation release/retry, stable PDFs, worker no-completion failure paths, and durable job retry/failure suites pass; real scanner, storage, dispatcher, load, and recovery remain open. |

## Release rule

No evaluation result authorizes deployment. Production requires all hard evaluations, the full production gate, and explicit human approval.
