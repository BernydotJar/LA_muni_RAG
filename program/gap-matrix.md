# Matriz de gaps hacia production-ready

Fecha de corte: 2026-07-19

Baseline relacionado: program/baseline-audit.md

Regla: un slice verde no convierte un workstream completo en achieved.

## 1. Matriz maestra WS-01 a WS-11

| WS | Estado | Capacidad disponible | Gap mínimo para cumplir el goal | Evidencia de aceptación requerida | Prioridad | Depende de |
|---|---|---|---|---|---|---|
| WS-01 Baseline and Architecture | partial | Baseline reconciliado; boundaries, ownership, bounded contexts, ADR y control YAML versionados | Completar el mapeo requisito-por-requisito y mantener graph/ledger alineados con cada slice | Auditoría GAP-001 completa; branch/PR/CI actuales; cero claims obsoletos | P0 | — |
| WS-02 Corpus and Source Inventory | partial | Inventario válido: 17 fuentes, 4 verificadas, 1 DMP adquirido, 4 missing, 0 ingested; gate local de seguridad disponible | Completar corpus Antigua/Mixco, autoridad/vigencia/licencia, scanner real y storage seguro sin promover comparativos | Hashes/bytes/provenance; veredicto malware real; aprobación; estados honestos; manifest reconciliado | P0 | WS-01 |
| WS-03 Ingestion and Document Library | partial | Extractores existentes, chunking, embeddings, manifest, CLI local y gate fail-closed de MIME/firma/tamaño/ClamAV/quarantine/retry | Biblioteca autenticada, upload/URL acquisition, scanner operativo, extracción PDF aislada, jobs, retries, locking, audit, retention, writes tenant-scoped y APIs | Test corrupt/retry/idempotency; scanner real; integración DB/object storage; métricas; runbook | P0 | WS-02, WS-07 |
| WS-04 Retrieval and Evidence | partial | Keyword/phrase/hybrid/vector, dedupe, ranking y citas | Filtros completos, reranking evaluado, contradicciones, vigencia, missing-source y groundedness | Eval corpus real con thresholds; citation fidelity; conflict visibility; isolation tests | P0 | WS-02, WS-03, WS-07 |
| WS-05 Procedure Schema and Compiler | partial | Workflow estructurado preliminar y gaps | Procedure/version/step schema completo; lifecycle; decision gates; approval; water compiler | Workflow JSON versionado; 47 categorías de agua; citas/evidence status por paso; human review | P0 | WS-04 |
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
| GET /api/v1/ingestion-jobs | missing | Tabla declarada, sin service/endpoint |
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
| Clasificación específica de agua | missing | Sólo keywords de demo/retrieval; no workflow type agua | Añadir clasificación gobernada y pruebas |
| 47 categorías de investigación | missing | Template public_works tiene 6 pasos genéricos | Modelo de investigación completo sin convertir categorías en hechos |
| Campos completos por paso | partial | action/docs/citations/confidence disponibles parcialmente | Añadir actors, unit, preconditions, systems, approvals, deadlines, criteria, cadence, risks, unknowns |
| Citas por paso | partial | Match heurístico por texto | Citation fidelity eval y vínculo a document version/section |
| Evidencia faltante explícita | partial | Usa insufficient y gaps | Adoptar missing_evidence y texto canónico requerido |
| Antigua-first | partial | Governance rule y tests sintéticos | Probar contra corpus real y conflictos |
| Mixco comparativo | partial | Metadata remota y tests de autoridad | Adquirir manuales y conservar warning en todo contrato/UI |
| Seguimiento de caso | partial | LocalStorage | Crear instancia persistente y tenant-scoped |
| EVAL-WATER-001 | missing | No existe suite con ese id | Hard eval end-to-end requerido |

## 4. Hard eval matrix

| Eval requerido | Estado | Gap de cierre |
|---|---|---|
| EVAL-PROCEDURE-001 | missing | Validar classification, steps, dependencies, docs, citations, state, gaps y workflow JSON |
| EVAL-WATER-001 | partial | Smoke DB/HTTP devuelve workflow Antigua-first sin fuga; faltan corpus real ingerido y 47 categorías |
| EVAL-MIXCO-001 | partial | Existe caso sintético de authority; falta flujo/corpus/warning end-to-end |
| EVAL-OS-INTEGRATION-001 | partial | Provider ProcedureWorkflow y boundary pasan; falta consumer OS Electoral y prueba entre repos |
| EVAL-CONTENT-INTEGRATION-001 | missing | Requiere ClaimPack y boundary |
| EVAL-BOUNDARY-001 | partial | Provider rechaza estrategia/movilización/contenido; falta matriz de todos los endpoints/consumers |
| EVAL-TENANT-001 | partial | Gate PostgreSQL 16.14 + HTTP niega A/B, audita y no filtra; falta topología aprobada y catálogo completo |
| EVAL-CONFLICT-001 | missing | Versiones contradictorias visibles y review |
| EVAL-CORRUPT-001 | partial | Replay corrupto se invalida/audita/reintenta; artefactos locales corruptos, tampered y scanner-failure se bloquean, ponen en quarantine y admiten retry limpio; faltan scanner real, job state y DB/object storage |

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
5. P0 — adquirir e ingerir corpus mínimo de agua Antigua y comparativos Mixco;
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
