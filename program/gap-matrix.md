# Matriz de gaps hacia production-ready

Fecha de corte: 2026-07-21

Baseline relacionado: program/baseline-audit.md

Regla: un slice verde no convierte un workstream completo en achieved.

## 1. Matriz maestra WS-01 a WS-11

| WS | Estado | Capacidad disponible | Gap mínimo para cumplir el goal | Evidencia de aceptación requerida | Prioridad | Depende de |
|---|---|---|---|---|---|---|
| WS-01 Baseline and Architecture | partial | Baseline reconciliado; boundaries, ownership, bounded contexts, ADR y control YAML versionados | Completar el mapeo requisito-por-requisito y mantener graph/ledger alineados con cada slice | Auditoría GAP-001 completa; branch/PR/CI actuales; cero claims obsoletos | P0 | — |
| WS-02 Corpus and Source Inventory | partial | Inventario válido: 17 fuentes, 4 verificadas, 1 DMP adquirido, 4 missing, 0 ingested; gate local de seguridad disponible | Completar corpus Antigua/Mixco, autoridad/vigencia/licencia, scanner real y storage seguro sin promover comparativos | Hashes/bytes/provenance; veredicto malware real; aprobación; estados honestos; manifest reconciliado | P0 | WS-01 |
| WS-03 Ingestion and Document Library | partial | Gate fail-closed de artefactos; PDF binario acotado; parse-once; jobs durables tenant-scoped con idempotencia por digest, leases/fencing/retry/audit; vectores tenant-scoped atómicos; RLS non-owner y CI PostgreSQL | Biblioteca/API autenticada, worker dispatcher, scanner y object storage operativos, cuotas/admisión distribuida, deadline total, dead-letter, métricas, roles/topología/load/HA productivos y activar retrieval vectorial evaluado | Scanner/storage/API/worker reales; pruebas staging/load/restore; role drift; métricas/SLO; eval de recall/citas/autorización | P0 | WS-02, WS-07 |
| WS-04 Retrieval and Evidence | partial | Keyword/phrase/hybrid/vector, dedupe, ranking y citas | Filtros completos, reranking evaluado, contradicciones, vigencia, missing-source y groundedness | Eval corpus real con thresholds; citation fidelity; conflict visibility; isolation tests | P0 | WS-02, WS-03, WS-07 |
| WS-05 Procedure Schema and Compiler | partial | Workflow estructurado; contrato v1 completo por paso; clasificador y checklist Antigua-first de 47 categorías para agua; missing evidence explícita | Persistencia de procedure/version, lifecycle, decision gates con evidencia, review/approval y corpus real para asignar actores, sistemas, plazos y autoridad | Workflow versionado y persistido; citas/evidence status por paso contra corpus real; human review | P0 | WS-04 |
| WS-06 Procedure Cases and Tracking | partial | Workspace/portfolio en LocalStorage | Persistencia tenant-scoped, API, current step, docs, blockers, validation, follow-up, dossier y audit | API/DB integration tests; immutable audit; binding a procedure version; authorization | P0 | WS-05, WS-07 |
| WS-07 Identity, Tenancy and RBAC | partial | Identity, tenants, 10 roles, credential digest, RLS y procedure-query v1 con gate PostgreSQL/HTTP | Provisioning/rotation productivos y extender el control a todo endpoint requerido | Staging/production-shaped negative tests por endpoint; audit/access review; EVAL-TENANT completo | P0 | WS-01 |
| WS-08 Integration Contracts | partial | 9 schemas/ejemplos, OpenAPI 3.1.1 y provider `ProcedureWorkflow` v1 seguro/idempotente | EvidenceBundle/Assessment/Gap/ClaimPack providers, consumers vecinos y pruebas entre repos | Provider/consumer contract tests; timeout/retry; boundary; refs/versiones preservadas | P0 | WS-01, WS-05, WS-07 |
| WS-09 Frontend and UX | partial | Demo Pages, widget, workflow/deep-dive/cases locales | Admin autenticado, library/source viewer, reviews/approvals, cases server-side, estados y a11y | Browser E2E desktop/mobile; WCAG 2.2 AA; auth/error/empty-state tests | P1 | WS-03, WS-05, WS-06, WS-07 |
| WS-10 Security, Platform and Ops | partial | Backend CI, imagen no-root, runbooks, threat/privacy y gate local PostgreSQL/API | Plataforma/Terraform/secrets/observabilidad, scans, backup/restore real, rollback, incident y límites distribuidos | Zero high/critical; staging; restore/rollback drill; SLO/alerts; imagen firmada por digest | P0 | WS-07 y todos los servicios |
| WS-11 Quality, Evals and Docs | partial | Suite ampliada, contratos/inventario/domain gates y docs obligatorias presentes | Nueve hard evals completos, E2E/browser/a11y/load, regression global y freshness automática | Todos hard evals verdes; CI required; docs lint/link; evidence register actualizado | P0 | Todos |

## 2. Gaps de API v1

| Endpoint requerido | Estado actual | Gap |
|---|---|---|
| GET /api/v1/sources | missing | Inventario sólo file-based en origin/main |
| POST /api/v1/sources | missing | Sin auth, tenant, validation, idempotency o audit |
| GET /api/v1/documents | missing | Sin library API |
| POST /api/v1/documents | missing | Feature 054 es CLI local, no upload API |
| GET /api/v1/ingestion-jobs | missing | Service tenant-scoped disponible; falta endpoint autenticado, paginación y autorización de operador |
| POST /api/v1/search | missing | Existe GET /api/search MVP sin v1 ni filtros completos |
| POST /api/v1/evidence-bundles | missing | Tipo interno no cumple EvidenceBundle externo |
| GET /api/v1/procedures | missing | Sólo GET /api/procedure que compone al vuelo |
| POST /api/v1/procedure-queries | implemented_with_limits | Sólo `ProcedureWorkflow`; provider/DB gate local pasan; bundle/assessment, consumer, staging y lifecycle faltan |
| GET /api/v1/workflows/:id | missing | Workflows no persistidos/versionados |
| POST /api/v1/workflow-drafts | missing | Sin lifecycle |
| POST /api/v1/workflow-reviews | missing | Sin review service |
| POST /api/v1/workflow-approvals | missing | Sin approval/audit |
| POST /api/v1/procedure-cases | missing | Sólo LocalStorage |
| GET /api/v1/procedure-cases/:id | missing | Sin case service |
| POST /api/v1/evidence-gap-requests | missing | Gaps sólo se calculan en respuesta |

Autenticación, tenant scope, RBAC, validación, idempotencia, audit y rate limit están implementados sólo para `POST /api/v1/procedure-queries`. Siguen ausentes transversalmente en el catálogo; las rutas pre-v1 son 404 por defecto en producción porque usan queries globales/wildcard CORS.

## 3. Gaps del golden use case agua

| Requisito | Estado | Evidencia actual | Cierre |
|---|---|---|---|
| Clasificación específica de agua | implemented_with_limits | `potable_water_project`, regla prioritaria y domain eval 7/7 | Validar recall/precision contra consultas y corpus reales |
| 47 categorías de investigación | implemented_with_limits | Template dedicado con 47 categorías ordenadas y prueba exacta | Validar orden/dependencias oficiales con corpus y revisión humana |
| Campos completos por paso | partial | El contrato v1 devuelve todos los campos; unsupported actors/unit/system/approval/deadline/cadence quedan nulos o vacíos | Poblar sólo desde evidencia citable y persistir revisiones/aprobaciones |
| Citas por paso | partial | Identidad document/version/section y prueba selectiva: una cita PDM-OT no promueve los otros 46 pasos | Medir citation fidelity contra corpus real y resolver contradicciones |
| Evidencia faltante explícita | implemented | Mapper v1 usa `missing_evidence` y `Documento o regla pendiente de localizar y validar.` | Mantener el control en nuevos endpoints y UI |
| Antigua-first | partial | Governance rule y tests sintéticos | Probar contra corpus real y conflictos |
| Mixco comparativo | partial | Metadata remota y tests de autoridad | Adquirir manuales y conservar warning en todo contrato/UI |
| Seguimiento de caso | partial | LocalStorage | Crear instancia persistente y tenant-scoped |
| EVAL-WATER-001 | passed_with_corpus_and_runtime_limitations | Suite nombrada, gate CI y documentación; 4/4 pruebas focales | Corpus real, retrieval thresholds, conflictos, lifecycle y caso persistido |

## 4. Hard eval matrix

| Eval requerido | Estado | Gap de cierre |
|---|---|---|
| EVAL-PROCEDURE-001 | passed_with_corpus_and_lifecycle_limitations | 4/4 prueba clasificación conservadora, workflow sin evidencia, citas municipales identity-bound por paso y JSON v1; faltan corpus real, retrieval thresholds, conflictos, lifecycle, aprobación y casos |
| EVAL-WATER-001 | passed_with_corpus_and_runtime_limitations | 47 categorías, contrato completo, missing evidence y citation selectivity pasan; faltan corpus real ingerido, conflictos, lifecycle y caso persistido |
| EVAL-MIXCO-001 | passed_with_corpus_and_corroboration_limitations | 4/4 prueba clasificación, autoridad comparativa, warning canónico, gaps de corroboración, mapping v1 y rechazo de promoción silenciosa; faltan corpus real y corroboración Antigua |
| EVAL-OS-INTEGRATION-001 | partial | Provider ProcedureWorkflow y boundary pasan; falta consumer OS Electoral y prueba entre repos |
| EVAL-CONTENT-INTEGRATION-001 | missing | Requiere ClaimPack y boundary |
| EVAL-BOUNDARY-001 | passed_for_current_provider_surface | 4/4 prueba solicitud mixta, contenido puro, violación oculta en contexto, no-compilación, audit sin payload y consulta procedimental permitida; futuros endpoints/consumers deben preservar el boundary |
| EVAL-TENANT-001 | partial | Gates PostgreSQL 16.14/pgvector 0.8.5 niegan A/B para procedure-query y job/vector con rol non-owner; faltan topología aprobada, drift y catálogo/API completo |
| EVAL-CONFLICT-001 | missing | Versiones contradictorias visibles y review |
| EVAL-CORRUPT-001 | partial | Replay corrupto, artefactos/PDF hostiles, mutación ABA, artifact mismatch, lease stale y rollback vector/job fallan cerrado; jobs/retries/DB ya tienen evidencia sintética; faltan scanner/object storage/API/worker reales y sandbox/carga aprobados |

## 5. Documentación y tooling obligatorio

| Artefacto | Estado | Prioridad |
|---|---|---|
| docs/product/product-boundaries.md | present | P0 |
| docs/product/procedural-intelligence-vision.md | present | P1 |
| docs/architecture/bounded-contexts.md | present | P0 |
| docs/architecture/system-context.md | present | P0 |
| docs/architecture/data-ownership.md | present | P0 |
| docs/integrations/os-electoral.md | present; consumer pending | P0 |
| docs/integrations/content-agency.md | present; provider/consumer pending | P0 |
| docs/integrations/contracts.md | present; provider slice current | P0 |
| docs/data/source-inventory.md | present | P1 |
| docs/data/ingestion-runbook.md | present; platform controls pending | P1 |
| docs/raw-pdf-extraction.md | present; OS sandbox, distributed admission, scanner and load approval pending | P0 |
| docs/tenant-ingestion-runtime.md | present; API/worker/scanner/storage/production topology pending | P0 |
| docs/security/threat-model.md | present; human review pending | P0 |
| docs/security/tenancy.md | present; v1 slice verified | P0 |
| docs/security/rbac.md | present; v1 slice verified | P0 |
| docs/operations/deployment.md | present; no deployment | P0 |
| docs/operations/backup-restore.md | present; no restore drill | P0 |
| docs/operations/incident-response.md | present; roster/exercise pending | P0 |
| docs/testing/eval-harness.md | present; hard evals incomplete | P0 |
| program/skill-usage-register.md | present | P1 |
| program/context7-evidence.md | present | P1 |
| program/task-graph.yaml | present; active | P0 |
| program/task-ledger.yaml | present; active | P0 |
| skills-lock.json | missing; AutoSkills no verificado | P1 |

## 6. Critical path recomendado

1. P0 — reconciliar Git y declarar origin/main como base canónica sin perder los dos commits locales válidos;
2. P0 — reconciliar source inventory, seed y artifact PDM-OT;
3. P0 — fijar boundaries, ownership, contratos de datos y modelo tenant/RBAC;
4. P0 — extender el provider v1 probado a documents/procedures/workflows/cases y consumers;
5. P0 — conectar los controles tenant/job/vector a API/worker, operar scanner y storage durables, y aprobar roles/load/monitoring; sólo entonces escanear e ingerir el DMP adquirido y el corpus mínimo restante de Antigua/Mixco;
6. P0 — completar retrieval filtrado y compiler versionado con human approval;
7. P0 — implementar los nueve hard evals y regression global;
8. P0 — cerrar plataforma, seguridad, backup/restore, rollback e incident response;
9. P1 — completar UX autenticada, accessibility y documentación-as-code.

## 7. Criterio para promover estados

Un workstream sólo puede pasar a achieved cuando:

- todos sus requisitos del goal tienen evidencia directa;
- la implementación está en la rama canónica;
- los tests cubren el alcance real, no sólo fixtures;
- los controles negativos y de aislamiento pasan;
- la documentación obligatoria coincide con runtime;
- la regresión global de main es verde;
- no queda un gap P0 o P1 requerido dentro de ese workstream.

Hasta entonces, los estados de esta matriz deben conservarse como partial, missing o unverified.
