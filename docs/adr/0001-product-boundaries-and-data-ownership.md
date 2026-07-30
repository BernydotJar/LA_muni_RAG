# ADR-0001: límites del producto y ownership de datos

Estado: Accepted  
Fecha: 2026-07-18  
Decision owners: Municipal Procedural Intelligence Platform program  
Implementación: parcial; contratos/adapters todavía pendientes

## Contexto

El programa incluye tres productos independientes:

1. LA Muni RAG, sistema de evidencia y procedimientos;
2. OS Electoral, sistema operativo de campaña;
3. AI-Native Content Agency SaaS, sistema de producción/distribución de contenido.

Sin una frontera explícita, los tres podrían duplicar documentos, mezclar decisiones estratégicas con autoridad jurídica o editar copias divergentes de procedimientos y claims. El baseline de LA Muni RAG, además, tiene capacidades útiles de RAG pero carece de contratos externos versionados, tenant/RBAC integral y lifecycle persistente de procedimientos. El diseño debe fijar ownership sin declarar esas capacidades como implementadas.

## Evidencia considerada

- LA Muni RAG en `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`: [README](../../README.md), source inventory, esquema `rag.*`, retrieval y workflow MVP; estado consolidado en la [auditoría de baseline](../../program/baseline-audit.md).
- OS Electoral en `b034ed28480267b65c50e343b3dec26ace44422f`: [README de producto](https://github.com/BernydotJar/OS-Electoral/blob/b034ed28480267b65c50e343b3dec26ace44422f/README.md) y [arquitectura de programa](https://github.com/BernydotJar/OS-Electoral/blob/b034ed28480267b65c50e343b3dec26ace44422f/docs/program-architecture.md). Declara campaign workspace/strategy/operations como propios; su stack permanece draft y human-blocked.
- Content Agency en `20a6e31ccaa54f10327858bee33996c52242f4e3`, rama inspeccionada `feat/production-foundation-v1`: [README](https://github.com/BernydotJar/AI-Native-Content-Agency-SaaS/blob/20a6e31ccaa54f10327858bee33996c52242f4e3/README.md) y [production foundation](https://github.com/BernydotJar/AI-Native-Content-Agency-SaaS/blob/20a6e31ccaa54f10327858bee33996c52242f4e3/docs/architecture/production-foundation.md). Demuestra control plane sandbox, no publicación ni producción desplegada. Al no ser evidencia de `main`, no se asume que esas capacidades estén integradas canónicamente.

## Decisión

### 1. Separar dominios por resultado

- LA Muni RAG posee conocimiento documental, evidencia, procedimientos, workflow governance y seguimiento documental de casos.
- OS Electoral posee campaña, estrategia, territorio, segmentos, decisiones, gates y operaciones electorales.
- Content Agency posee briefs/misiones de contenido, corridas, artefactos, Greenlight, publicación y performance.

La matriz detallada está en [Límites del producto](../product/product-boundaries.md).

### 2. Un solo writer autoritativo por agregado

El producto owner es el único que crea o modifica su agregado autoritativo. Un consumidor puede registrar un foreign ID y snapshot inmutable con provenance, pero cualquier decisión derivada vive en un agregado propio. No existe ownership compartido.

### 3. Integrar sólo por API/schema

Los productos conservan bases de datos separadas. El intercambio permitido es:

- API versionada con modelos validados; o
- artefacto sandbox/file-based validado por el mismo JSON Schema y sin acoplamiento a un filesystem compartido.

Se prohíben shared tables, acceso DB cross-product, import de migrations ajenas, lectura del storage interno, replicación editable y distributed transactions.

### 4. Mantener identidad, versiones y provenance

- IDs públicos son opacos y estables.
- ID de lineage y versión inmutable son conceptos distintos.
- `schema_version` no sustituye `workflow_version` o `document_version_id`.
- Cada snapshot conserva producer, tenant, tiempo, request/correlation, input refs, citas, autoridad, jurisdicción, limitaciones y gaps.
- Breaking changes requieren un nuevo major contract; no se cambia silenciosamente `v1`.

Las reglas completas están en [Ownership de datos](../architecture/data-ownership.md).

### 5. Usar contratos explícitos

Los artefactos objetivo son:

- LA Muni RAG -> OS Electoral: `EvidenceBundle`, `ProcedureWorkflow`, `ProcedureAssessment`;
- OS Electoral -> LA Muni RAG: `ProcedureQueryRequest`, `EvidenceGapRequest`;
- OS Electoral -> Content Agency: `ApprovedCommunicationBrief`;
- LA Muni RAG -> Content Agency: `ClaimPack`;
- Content Agency -> OS Electoral: `ContentPackage`.

Su catálogo y estado están en [Contratos entre productos](../integrations/contracts.md).

### 6. Hacer visible lo no implementado

La documentación distingue contrato objetivo de runtime actual. Hasta que existan OpenAPI/JSON Schemas, auth/tenant scope, adapters y contract tests, ninguna integración se describe como operativa.

## Consecuencias

### Positivas

- Evita tres corpus o procedimientos divergentes.
- Conserva trazabilidad jurídica a través de decisiones y contenido.
- Permite evolución independiente de storage y runtime.
- Hace posible probar refusals y compatibilidad por contrato.
- Limita el blast radius de credenciales, migrations y fallos.

### Costes

- Requiere adapters, schemas, OpenAPI y contract tests por versión.
- Introduce consistencia eventual y manejo explícito de retries/supersession.
- Obliga a resolver identidad y tenant mapping entre productos.
- Un consumidor no puede continuar mutando una copia local si el owner no está disponible.

### Riesgos que permanecen

- Un ID opaco puede referir al tenant equivocado si authorization no se valida en el owner.
- Un snapshot válido puede quedar superseded; el consumidor debe conservar/consultar estado y limitaciones.
- Un contract test de forma no demuestra autoridad jurídica o groundedness.
- La evidencia de repos vecinos es un snapshot y puede cambiar; cualquier implementación debe volver a inspeccionar su estado canónico.

## Alternativas rechazadas

| Alternativa | Motivo de rechazo |
|---|---|
| Monolito con módulos de campaña y contenido dentro de LA Muni RAG | Viola ownership, amplía datos sensibles y desvía la misión documental/procedimental. |
| Base de datos o tablas compartidas | Acopla migrations/autorización, permite writes no gobernados y rompe ownership. |
| Copia completa del corpus en OS Electoral o Content Agency | Crea versiones/autoridad divergentes y provenance difícil de auditar. |
| Sincronización bidireccional genérica | No define conflicto owner, facilita last-write-wins y borra provenance. |
| Mensajería/event bus antes de contratos | Cambia transporte sin resolver semántica, identidad o compatibilidad. |
| Recomendación estratégica tratada como fuente legal | Confunde una decisión del consumidor con evidencia del productor. |

## Guardrails verificables

Antes de habilitar una integración:

1. JSON Schema y OpenAPI del major version están versionados.
2. Provider y consumer contract tests validan success, refusal, unknown fields, incompatible version, tenant mismatch, replay y conflict.
3. El adapter no importa repository/storage del producto vecino.
4. Logs/audit registran IDs y correlation sin cuerpos sensibles.
5. EVAL-BOUNDARY-001, EVAL-OS-INTEGRATION-001 o EVAL-CONTENT-INTEGRATION-001 pasa según el flujo.
6. La documentación sigue declarando cualquier limitación operacional real.

## Seguimiento

Esta ADR habilita el diseño; no cierra WS-08. El siguiente trabajo debe crear schemas/OpenAPI, identity mapping, adapters y contract tests sin cambiar las fronteras aquí aceptadas.

## Documentos relacionados

- [Visión de inteligencia procedimental](../product/procedural-intelligence-vision.md)
- [Contextos delimitados](../architecture/bounded-contexts.md)
- [Contexto del sistema](../architecture/system-context.md)
- [Integración con OS Electoral](../integrations/os-electoral.md)
- [Integración con Content Agency](../integrations/content-agency.md)
