# Matriz de gaps hacia production-ready

Fecha de corte: 2026-07-18

Baseline relacionado: program/baseline-audit.md

Regla: un slice verde no convierte un workstream completo en achieved.

## 1. Matriz maestra WS-01 a WS-11

| WS | Estado | Capacidad disponible | Gap mínimo para cumplir el goal | Evidencia de aceptación requerida | Prioridad | Depende de |
|---|---|---|---|---|---|---|
| WS-01 Baseline and Architecture | partial | DB y módulos RAG; specs por feature | Reconciliar origin/main con 2 commits locales; definir boundaries, ownership, bounded contexts, ADRs y graph del programa | HEAD canónico limpio; docs obligatorias; ADR aceptado; task graph validado | P0 | — |
| WS-02 Corpus and Source Inventory | partial | 4 seeds; 1 PDF verificado; inventario remoto de 16 fuentes | Unificar inventario legado/nuevo; ampliar corpus Antigua; adquirir Mixco requerido sin promoverlo a autoridad local | Manifest reconciliado; hashes; provenance; estados missing_source honestos; cero conflictos silenciosos | P0 | WS-01 |
| WS-03 Ingestion and Document Library | partial | Extractores, chunking, embeddings, manifest y CLI local | Biblioteca autenticada, upload/URL acquisition, MIME/malware validation, jobs, retries, locking, audit, retention y APIs | Test corrupt/retry/idempotency; integración DB/object storage; métricas; runbook | P0 | WS-02, WS-07 |
| WS-04 Retrieval and Evidence | partial | Keyword/phrase/hybrid/vector, dedupe, ranking y citas | Filtros completos, reranking evaluado, contradicciones, vigencia, missing-source y groundedness | Eval corpus real con thresholds; citation fidelity; conflict visibility; isolation tests | P0 | WS-02, WS-03, WS-07 |
| WS-05 Procedure Schema and Compiler | partial | Workflow estructurado preliminar y gaps | Procedure/version/step schema completo; lifecycle; decision gates; approval; water compiler | Workflow JSON versionado; 47 categorías de agua; citas/evidence status por paso; human review | P0 | WS-04 |
| WS-06 Procedure Cases and Tracking | partial | Workspace/portfolio en LocalStorage | Persistencia tenant-scoped, API, current step, docs, blockers, validation, follow-up, dossier y audit | API/DB integration tests; immutable audit; binding a procedure version; authorization | P0 | WS-05, WS-07 |
| WS-07 Identity, Tenancy and RBAC | missing | Token compartido sólo para feedback | Identity, tenants, memberships, 10 roles, resource authorization, RLS y credentials | EVAL-TENANT-001; negative tests; audit sin metadata leakage | P0 | WS-01 |
| WS-08 Integration Contracts | missing | Ningún contrato externo versionado | OpenAPI/JSON Schema para cinco artefactos, event envelope, adapters e idempotency | Schema validation; consumer/provider contract tests; boundary refusal | P0 | WS-01, WS-05, WS-07 |
| WS-09 Frontend and UX | partial | Demo Pages, widget, workflow/deep-dive/cases locales | Admin autenticado, library/source viewer, reviews/approvals, cases server-side, estados y a11y | Browser E2E desktop/mobile; WCAG 2.2 AA; auth/error/empty-state tests | P1 | WS-03, WS-05, WS-06, WS-07 |
| WS-10 Security, Platform and Ops | partial | Pages deploy; sanitización y health parcial | Backend platform, Terraform, secrets, observabilidad, backups, restore, rollback, incident, rate limits distribuidos | Threat/privacy review; zero high/critical; restore drill; rollback test; SLO/alerts | P0 | WS-07 y todos los servicios |
| WS-11 Quality, Evals and Docs | partial | 349 tests; harness sintético; docs por feature | Nueve hard evals, regression global main, docs obligatorias, Skills/Context7 records y freshness | Todos hard evals verdes; CI required; docs lint; evidence register actualizado | P0 | Todos |

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
| POST /api/v1/procedure-queries | missing | No contrato ProcedureQueryRequest |
| GET /api/v1/workflows/:id | missing | Workflows no persistidos/versionados |
| POST /api/v1/workflow-drafts | missing | Sin lifecycle |
| POST /api/v1/workflow-reviews | missing | Sin review service |
| POST /api/v1/workflow-approvals | missing | Sin approval/audit |
| POST /api/v1/procedure-cases | missing | Sólo LocalStorage |
| GET /api/v1/procedure-cases/:id | missing | Sin case service |
| POST /api/v1/evidence-gap-requests | missing | Gaps sólo se calculan en respuesta |

Requisitos transversales ausentes en la API: autenticación global, tenant scope, RBAC, cursor pagination, idempotency keys, audit de mutaciones y rate limits distribuidos.

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
| EVAL-WATER-001 | missing | Corpus Antigua-first y 47 categorías sin invenciones |
| EVAL-MIXCO-001 | partial | Existe caso sintético de authority; falta flujo/corpus/warning end-to-end |
| EVAL-OS-INTEGRATION-001 | missing | Requiere contratos y adapter OS Electoral |
| EVAL-CONTENT-INTEGRATION-001 | missing | Requiere ClaimPack y boundary |
| EVAL-BOUNDARY-001 | missing | Rechazo explícito de estrategia electoral/calendario |
| EVAL-TENANT-001 | missing | Cross-tenant deny + audit + no leakage |
| EVAL-CONFLICT-001 | missing | Versiones contradictorias visibles y review |
| EVAL-CORRUPT-001 | partial | Extractores tienen fallos estables; falta job/retry state end-to-end |

## 5. Documentación y tooling obligatorio

| Artefacto | Estado | Prioridad |
|---|---|---|
| docs/product/product-boundaries.md | missing | P0 |
| docs/product/procedural-intelligence-vision.md | missing | P1 |
| docs/architecture/bounded-contexts.md | missing | P0 |
| docs/architecture/system-context.md | missing | P0 |
| docs/architecture/data-ownership.md | missing | P0 |
| docs/integrations/os-electoral.md | missing | P0 |
| docs/integrations/content-agency.md | missing | P0 |
| docs/integrations/contracts.md | missing | P0 |
| docs/data/source-inventory.md | missing; existe nombre distinto en origin/main | P1 |
| docs/data/ingestion-runbook.md | missing; existe runbook parcial en raíz docs | P1 |
| docs/security/threat-model.md | missing | P0 |
| docs/security/tenancy.md | missing | P0 |
| docs/security/rbac.md | missing | P0 |
| docs/operations/deployment.md | missing | P0 |
| docs/operations/backup-restore.md | missing | P0 |
| docs/operations/incident-response.md | missing | P0 |
| docs/testing/eval-harness.md | missing | P0 |
| program/skill-usage-register.md | missing | P1 |
| program/context7-evidence.md | missing | P1 |
| program/task-graph.yaml | missing | P0 |
| program/task-ledger.yaml | missing | P0 |
| skills-lock.json | missing; AutoSkills no verificado | P1 |

## 6. Critical path recomendado

1. P0 — reconciliar Git y declarar origin/main como base canónica sin perder los dos commits locales válidos;
2. P0 — reconciliar source inventory, seed y artifact PDM-OT;
3. P0 — fijar boundaries, ownership, contratos de datos y modelo tenant/RBAC;
4. P0 — implementar APIs v1 y persistencia de documents/procedures/workflows/cases;
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
