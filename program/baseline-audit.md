# Auditoría de baseline de producción

Fecha de corte: 2026-07-18, America/Guatemala

Goal auditado: Municipal Procedural Intelligence Platform

Repositorio: BernydotJar/LA_muni_RAG

Checkout auditado: fix/052-post-merge-reconciliation, HEAD 0015cd5

Rama remota canónica observada: origin/main, 4950ba3

Resultado global: PARTIAL — NO PRODUCTION-READY

## 1. Conclusión ejecutiva

El repositorio contiene una base técnica útil y probada para RAG documental: esquema PostgreSQL, extracción de PDF/TXT/Markdown/DOCX, chunking, hashing, pgvector opcional, recuperación keyword/phrase/hybrid, citas, un compositor preliminar de workflows y superficies estáticas de demostración. Los gates locales del checkout auditado pasan: TypeScript, 349 pruebas, seis evaluaciones sintéticas de domain packs, validador de template y verificador de Pages.

Esa evidencia no satisface el goal completo. Faltan controles P0 que bloquean cualquier declaración de producción:

- autenticación integral, multi-tenancy y RBAC;
- APIs versionadas de fuentes, documentos, evidencia, workflows y casos;
- contratos OpenAPI/JSON Schema y contract tests con OS Electoral y Content Agency;
- lifecycle versionado de procedimientos y workflows con revisión y aprobación humana;
- persistencia server-side de casos procedimentales;
- golden use case de agua con las 47 categorías de investigación y citas por paso;
- corpus Antigua y Mixco adquirido, reconciliado e ingerido;
- filtros de retrieval por tenant, jurisdicción, autoridad, vigencia y confidencialidad;
- contradicciones, conflictos de versiones, groundedness y hard evals obligatorios;
- Terraform, backend deployment, observabilidad operativa, backups, restore test, rollback e incident response;
- documentación obligatoria y registros de Skills, Context7 y programa.

Por tanto, las features existentes son incrementos dentro de un programa incompleto. Ningún workstream WS-01 a WS-11 está demostrado como achieved en el alcance del goal.

## 2. Semántica de estados

- achieved: el alcance completo del workstream está implementado y verificado contra el goal.
- partial: existe implementación útil, pero faltan requisitos o evidencia material.
- missing: no existe la capacidad requerida o sólo hay referencias nominales sin implementación.
- unverified: podría existir una capacidad, pero la evidencia disponible no permite probarla.

## 3. Reconciliación Git y fuente de verdad

### Checkout activo

- git rev-list --left-right --count HEAD...origin/main devolvió 2 56.
- El merge-base es 48fb2fe.
- Los dos commits locales son:
  - ab83070: artefactos generados dist-pages;
  - 0015cd5: ajuste de regex y checklist de Feature 052.
- Tras git fetch --prune ejecutado por el orquestador, la rama remota de tracking del checkout aparece gone.
- RTK.md ya era un archivo no rastreado antes de esta auditoría; no fue creado ni modificado aquí.

### Remoto canónico

- origin/main apunta a 4950ba3.
- PR #18 integró Feature 053 a su stack base; PR #19 llevó ese stack a main.
- PR #21 integró Feature 054 a su stack base; PR #22 llevó ese stack a main.
- gh pr list --state open no devolvió PRs abiertos.
- Los checks de PR #18 y #21 finalizaron SUCCESS.
- El último push de main ejecutó y aprobó únicamente Deploy GitHub Pages. No hay evidencia de una regresión completa disparada sobre el commit de merge 4950ba3.

### Regla de lectura usada

La funcionalidad ejecutada localmente se evaluó en HEAD 0015cd5. Las features 053 y 054 presentes sólo en origin/main se consideraron evidencia repository-wide parcial, soportada por inspección de objetos Git y CI remoto, pero no como gate local del checkout. No se cambió de rama.

## 4. Evidencia ejecutable

| Gate | Resultado | Alcance probado | Límite |
|---|---|---|---|
| rtk --version | PASS, 0.34.1 | Tooling RTK disponible | No prueba producto |
| rtk tsc --noEmit | PASS | Compilación TypeScript del checkout | No ejecuta infraestructura |
| npm test, fuera del sandbox | PASS, 349/349; 64 suites; 0 fail/cancel/skip | Unitarias e integraciones locales incluidas | No prueba origin/main, Postgres real, tenancy ni producción |
| npm run domain:evaluate, fuera del sandbox | PASS, 6/6 | Clasificación sintética de 5 packs | No consulta PostgreSQL ni retrieval; la propia documentación lo declara |
| npm run workflow:validate | PASS, 1 template public-works | Forma del template JSON | No prueba lifecycle, aprobación ni agua |
| node scripts/verify-pages-artifact.mjs | PASS | Integridad estática del artifact | No prueba backend |
| npm audit --audit-level=high | PASS, 0 vulnerabilidades reportadas | Dependencias conocidas por npm | No equivale a SAST, DAST, threat model o pentest |
| gh run list | Latest main Pages PASS; Feature 053/054 PR checks PASS | CI de slices y sitio estático | No hay gate global de producción sobre main |

Los primeros intentos de npm test y de los CLIs basados en tsx dentro del sandbox fallaron por EPERM al abrir listeners/IPC locales. Se repitieron fuera del sandbox y pasaron; esos EPERM se consideran una limitación del entorno de auditoría, no un defecto del producto.

## 5. Evidencia de corpus y contradicción de baseline

El checkout contiene:

- cuatro registros seed en db/seeds/001_core_documents.sql;
- un PDF local PDM-OT de 34,822,596 bytes;
- file lo reconoce como PDF 1.4;
- SHA-256 observado: 824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b;
- el hash coincide con docs/core-document-download-log.md y db/seeds/002_document_versions.sql;
- 224 secciones JSONL y un artifact SQL de 14,649 líneas.

origin/main añade un inventario de 16 registros:

- 2 verified;
- 8 acquisition_pending;
- 6 missing_source;
- 0 acquired o ingested;
- 9 registros Mixco, 6 Antigua y 1 nacional.

Existe una contradicción P0: origin/main marca antigua-pdm-ot como missing_source, mientras el checkout conserva un PDF municipal con URL, tipo y hash verificados. El inventario nuevo declara intencionalmente cero adquisiciones y no reconcilia el legado. Hasta resolver la autoridad, versión y provenance de ambos registros, el sistema no puede hacer afirmaciones globales fiables sobre cobertura o ingestión del corpus.

## 6. Estado por workstream

| Workstream | Estado | Evidencia positiva | Gap que impide achieved | Prioridad |
|---|---|---|---|---|
| WS-01 Baseline and Architecture | partial | Esquema RAG/agent/audit; specs por feature; domain pack municipal | No existen arquitectura canónica, ownership, boundaries entre productos, ADR global, task graph/ledger ni baseline reconciliado; feature_list y progress están obsoletos | P0 |
| WS-02 Corpus and Source Inventory | partial | Seed de 4 documentos, PDF PDM-OT con hash; origin/main añade contrato e inventario de 16 fuentes con Mixco comparativo | Inventario nuevo reporta 0 acquired/ingested y contradice PDM-OT legado; corpus objetivo Antigua/Mixco está ampliamente ausente | P0 |
| WS-03 Ingestion and Document Library | partial | Extractores TXT/Markdown/DOCX/PDF-adapter, manifest, indexación, estados y jobs en esquema; origin/main añade import/ingest local idempotente | Sin biblioteca autenticada, upload controlado, adquisición URL, worker/queue, retries operativos, MIME/malware gate, APIs, auditoría integral, retención o concurrencia segura | P0 |
| WS-04 Retrieval and Evidence | partial | Keyword, phrase, hybrid, pgvector opcional, dedupe, ranking y citas; no-evidence explícito | Sin filtros obligatorios, tenant scope, contradicciones, vigencia, missing-source detection, reranker validado, groundedness/citation fidelity sobre corpus real ni quality thresholds | P0 |
| WS-05 Procedure Schema and Workflow Compiler | partial | Clasificador, templates, pasos, documentos, citas, gaps y deep-dive | Contrato carece de lifecycle/version/approval; estados no coinciden con el goal; workflow de agua y sus 47 categorías no existen; responsables, sistemas, plazos y gates suelen faltar | P0 |
| WS-06 Procedure Cases and Tracking | partial | Workspace y portfolio local con estados, documentos, notas y audit UI | LocalStorage está documentado como no system of record; no DB, APIs, tenant, procedure-version binding, validación documental, audit confiable ni seguimiento institucional | P0 |
| WS-07 Identity, Tenancy and RBAC | missing | Sólo Bearer token compartido para procedure-feedback | Sin usuarios, tenants, diez roles mínimos, autorización por recurso, RLS/policies, integración credentials, auditoría de denegación o pruebas cross-tenant | P0 |
| WS-08 Integration Contracts | missing | Existe un tipo interno ProcedureEvidenceBundle no equivalente al contrato del goal | Sin OpenAPI, JSON Schema, event envelope, idempotency contracts, adapters ni contract tests para OS Electoral/Content Agency | P0 |
| WS-09 Frontend and UX | partial | Pages, widget, workflows, deep-dive y casos locales; pruebas responsive, ARIA puntual y reduced-motion | Sin document library autenticada, upload, source viewer completo, review/approval UI, casos server-side ni auditoría WCAG/accessibility formal | P1 |
| WS-10 Security, Platform and Operations | partial | CORS/body bounds, sanitización, auth/rate-limit del feedback, vector health, Pages deploy y npm audit limpio | CORS wildcard; auth parcial; limiter en memoria; sin Terraform, backend deploy, secrets/KMS, logs/metrics/traces, backup/restore, rollback, incident response, privacy/threat model o security gates globales | P0 |
| WS-11 Quality, Evals and Documentation | partial | 349 tests pasan; eval harness y documentación de features | Hard evals requeridos ausentes; retrieval cases son sintéticos; docs-as-code obligatorias faltan; no Context7/Skills registers; main no tiene gate global post-merge | P0 |

## 7. Auditoría de production gates

| Production gate | Estado | Evidencia |
|---|---|---|
| Authenticated document library | missing | README la declara incompleta; Feature 054 excluye auth y UI |
| Tenant isolation | missing | Sin tenant_id, RLS o policies |
| RBAC | missing | Sólo un token compartido para feedback |
| Ingestion pipeline | partial | Pipeline y CLI existen; operación production-grade no |
| Idempotency | partial | Chunks/manifest y Feature 054 cubren slices; APIs carecen de idempotency keys |
| Retrieval quality | unverified | Sólo fixtures/sintéticos; no corpus real end-to-end |
| Citation fidelity | partial | Contratos y tests locales; sin hard eval sobre corpus/versiones reales |
| Workflow lifecycle | missing | No draft/in_review/approved/superseded/archived persistente |
| Human approval | missing | No review/approval service ni audit |
| Procedure case tracking | partial | Sólo LocalStorage |
| APIs mínimas v1 | missing | No namespace api/v1; sólo endpoints MVP no equivalentes |
| OS Electoral contract tests | missing | Sin contrato |
| Content Agency contract tests | missing | Sin contrato |
| Security review | partial | Revisión limitada a Pages; declara no ser pentest |
| Privacy review | missing | Avisos puntuales no constituyen revisión |
| Accessibility review | unverified | Hay guardrails parciales; no audit WCAG/axe |
| Observability | partial | Estado vector sanitizado; sin telemetría operational |
| Backups | missing | Sin política o automatización |
| Restore test | missing | Sin evidencia |
| Terraform | missing | No archivos .tf |
| Deployment runbook | missing | Sólo workflow Pages; sin runbook backend |
| Rollback runbook | missing | Sin evidencia |
| Incident response | missing | Sin evidencia |
| Zero critical/high findings | unverified | npm audit reporta 0, pero no hay revisión integral |
| All required tests passing | unverified | Checkout local pasa; main y gates obligatorios no están cubiertos |
| All hard evals passing | missing | Los nueve evals requeridos no existen como suite |
| No deploy without human approval | unverified | main dispara Pages automáticamente; no se inspeccionó protección externa del environment |

## 8. Riesgos priorizados

### P0

| ID | Riesgo | Impacto | Evidencia | Acción de cierre |
|---|---|---|---|---|
| P0-01 | Baseline Git y corpus contradictorio | Implementar sobre una verdad equivocada o perder capacidades | HEAD diverge 2/56; PDM-OT adquirido versus missing_source | Crear rama desde origin/main, portar sólo commits válidos y reconciliar manifests con una migración verificable |
| P0-02 | Acceso cross-tenant o público no controlado | Fuga de documentos/metadatos | Sin tenant/RBAC/RLS; CORS wildcard | Implementar identity, tenant scope, RBAC, RLS y EVAL-TENANT-001 |
| P0-03 | Procedimientos no gobernados | IA puede producir un checklist sin lifecycle institucional | ProcedureWorkflow sin versión/status/approval | Modelo persistente de procedure/workflow versions, review, approval y audit |
| P0-04 | Golden use case sin evidencia | No se cumple la misión principal | No hay agua workflow/eval; corpus local mínimo | Inventariar/adquirir fuentes y construir EVAL-WATER-001 end-to-end |
| P0-05 | Integraciones inexistentes | OS Electoral y Content Agency no pueden consumir contratos estables | Sin OpenAPI/JSON Schema/adapters/tests | Versionar contratos, APIs, idempotency y contract tests |
| P0-06 | Plataforma no recuperable | Pérdida de datos o incidente sin respuesta | Sin Terraform/backups/restore/incident/rollback | Infra as code, observabilidad, backups y restore drill |
| P0-07 | Green tests con cobertura insuficiente | Falsa sensación de production readiness | 6/6 evals sintéticos; hard evals ausentes | Implementar nueve hard evals y gate global en main |

### P1

| ID | Riesgo | Impacto | Acción de cierre |
|---|---|---|---|
| P1-01 | Ingestión local sin operación concurrente segura | Corrupción/duplicación de manifests | DB-backed jobs, locking, retry policy, MIME/malware checks y audit |
| P1-02 | Retrieval sin filtros y conflicto visible | Respuesta de jurisdicción/vigencia incorrecta | Filtros obligatorios, contradicciones, version conflict y citation metrics |
| P1-03 | UX demo confundida con sistema | Usuarios pueden asumir seguimiento institucional | Separar demo/local, añadir superficies autenticadas y estados de autoridad |
| P1-04 | Accesibilidad no demostrada | Exclusión de usuarios y riesgo de compliance | Auditoría WCAG 2.2 AA automatizada y manual |
| P1-05 | Gobernanza documental obsoleta | Decisiones y progreso no trazables | Crear estructura docs obligatoria y automatizar freshness checks |

## 9. Comandos de auditoría y resultados materiales

Se ejecutaron de forma read-only, salvo la creación posterior de los dos documentos program solicitados:

- wc -l y sed sobre RTK.md: 259 líneas, leído completo.
- wc -l y sed sobre el goal: 1,281 líneas, leído completo.
- rtk git status; git branch -avv; rtk git log -n 30; git remote -v.
- git rev-list --left-right --count HEAD...origin/main: 2 56.
- git merge-base HEAD origin/main: 48fb2fe.
- git diff --stat HEAD..origin/main: 53 archivos, 3,387 inserciones y 1,940 eliminaciones.
- gh pr list --state open --limit 50: sin resultados.
- gh pr view 18, 19, 21 y 22: todos MERGED; checks de Features 053/054 SUCCESS.
- gh run list --limit 30: último main Pages SUCCESS; checks de slices observados.
- git ls-tree para HEAD y origin/main; find/rg para src, docs, db, migrations, specs, tasks y workflows.
- npm test fuera del sandbox: 349 pass, 0 fail, 0 cancel, 0 skip.
- rtk tsc --noEmit: PASS.
- npm run domain:evaluate fuera del sandbox: 6/6 PASS.
- npm run workflow:validate: status valid, 1 workflow.
- node scripts/verify-pages-artifact.mjs: PASS.
- npm audit --omit=dev --audit-level=high y npm audit --audit-level=high: 0 vulnerabilidades reportadas.
- file y shasum sobre PDM-OT: PDF 1.4 y hash coincidente.
- git show origin/main:.rag/source-inventory.json con jq: 16 total; 0 acquired/ingested.
- rg para api/v1, tenant_id, RLS, OpenAPI, contratos y hard evals: sin implementación correspondiente.
- ls -ld sobre los 17 documentos obligatorios y registros program: todos ausentes.

## 10. Limitaciones de esta auditoría

- No se cambió de rama ni se ejecutó origin/main localmente.
- No se inició PostgreSQL ni se aplicaron migraciones contra una base real.
- No se ejecutó un proveedor de embeddings, corpus end-to-end o retrieval real.
- No se hizo pentest, DAST, secret scan, restore drill, browser accessibility audit ni revisión legal de fuentes.
- No se inspeccionaron configuraciones privadas de GitHub environments.
- Un estado unverified no debe promocionarse a achieved hasta obtener evidencia directa.

La matriz accionable y sus criterios de cierre están en program/gap-matrix.md.
