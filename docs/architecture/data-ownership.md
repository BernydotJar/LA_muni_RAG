# Ownership de datos

Estado: política arquitectónica aceptada; enforcement integral pendiente  
Fecha de corte: 2026-07-18

## Regla principal

Cada agregado tiene exactamente un producto owner. Sólo ese producto puede crear su verdad autoritativa, aplicar transiciones de lifecycle y emitir nuevas versiones. Otros productos consumen referencias o snapshots inmutables; no mantienen una réplica editable.

La integración usa API versionada o intercambio validado por JSON Schema. No se comparten tablas, migrations, conexiones de base de datos ni transacciones distribuidas.

## Ownership por producto

### LA Muni RAG

| Agregado | Identidad estable | Versión/snapshot | Contexto owner |
|---|---|---|---|
| Source | `source_id` | Estado y evidencia de adquisición con timestamps | Source Catalog |
| Document | `document_id` | `document_version_id`, label y SHA-256 | Document Intelligence |
| Document section | `section_id` | Ligada de forma inmutable a `document_version_id` | Document Intelligence |
| Evidence item/bundle | `evidence_item_id` / `evidence_bundle_id` objetivo | Snapshot generado con citations y limitations | Evidence Retrieval |
| Procedure | `procedure_id` | `procedure_version_id` objetivo | Procedural Knowledge |
| Workflow | `workflow_id` | `workflow_version` objetivo | Procedural Knowledge / Workflow Governance |
| Workflow review/approval | ID de decisión objetivo | Evento inmutable sobre versión exacta | Workflow Governance |
| Procedure case | `procedure_case_id` objetivo | Revisión optimista/event stream objetivo | Procedural Cases |
| Evidence gap | `gap_id` objetivo | Estado auditado desde open hasta resolución | Source Catalog / Procedural Knowledge |

Los nombres con “objetivo” no existen todavía como contrato público completo. El modelo actual sí tiene UUIDs de documentos/versiones/secciones en PostgreSQL, `sourceId`/`documentVersion` en el inventario y `id` de workflow MVP, pero no una convención externa consolidada para todos los agregados.

### OS Electoral

OS Electoral es owner de:

- `campaign_id`, campaign charter y campaign state;
- strategic gates, decisions, objectives y approvals;
- territory/community references dentro del dominio electoral;
- electoral segments, proposals y commitments;
- field operations y electoral risks.

Si LA Muni RAG recibe `campaign_id` o `community_id`, los trata como referencias opacas aportadas por el cliente. No crea, valida semánticamente ni sincroniza el agregado electoral.

### Content Agency

Content Agency es owner de:

- content brief/mission y `brief_id`;
- content run y `content_package_id`;
- copy/media/content artifacts;
- Greenlight decision y manifest de artefactos;
- publication attempt/receipt y performance summary.

LA Muni RAG no almacena una copia mutable de esos objetos ni interpreta Greenlight como aprobación jurídica.

## Identidad pública

Los contratos externos deben cumplir estas reglas:

1. Los IDs son opacos, estables dentro del owner y nunca se reutilizan.
2. Un consumidor no deriva significado, tenant, tipo o autorización analizando un ID.
3. El tipo de recurso se expresa en el schema/campo, no depende de un prefijo informal.
4. Una lineage estable y una versión inmutable tienen identificadores distintos cuando ambas existen.
5. Toda referencia externa indica producer y tipo de recurso además del ID.
6. Los IDs internos existentes pueden mapearse en el adapter; no se exponen detalles de tablas como contrato.

El casing público objetivo es `snake_case`, como los artefactos del goal. Los tipos internos actuales usan una mezcla de UUID, SQL `snake_case` y TypeScript `camelCase`; esa diferencia debe resolverse en el Integration Gateway, no mediante un cambio silencioso del contrato.

## Tres dimensiones de versioning

| Dimensión | Campo/regla | Semántica |
|---|---|---|
| **Schema/API** | major version en ruta o `$id` y `schema_version: "v1"` | Define forma y semántica del contrato. Un breaking change crea `v2`. |
| **Entidad de dominio** | `document_version_id`, `procedure_version_id`, `workflow_version` | Identifica contenido institucional específico. Una revisión crea nueva versión, no mutación. |
| **Artefacto generado** | ID propio + `generated_at` + refs de inputs/versiones | Un bundle, assessment o claim pack es un snapshot reproducible/auditable. Regenerarlo crea otro snapshot aunque la consulta textual coincida. |

Una versión de schema no reemplaza una versión de procedimiento. Un cliente debe preservar ambas.

## Provenance mínimo

Todo artefacto interproducto debe poder aportar, directamente o por referencias tipadas:

| Campo conceptual | Propósito |
|---|---|
| `schema_version` | Interpretar el payload sin ambigüedad. |
| ID y versión del artefacto | Dedupe, audit y referencia posterior. |
| `tenant_id` | Fijar scope; no concede autorización por sí solo. |
| `producer` | Identificar producto/servicio owner y versión de implementación cuando aplique. |
| `generated_at` / `occurred_at` | Situar temporalmente el snapshot o evento. |
| `correlation_id` y `request_id` | Reconstruir la interacción sin usar datos sensibles como correlación. |
| IDs/versiones de inputs | Conectar query, procedure/document versions y brief refs. |
| `citations` / `citation_refs` | Volver a secciones/versiones de evidencia. |
| `jurisdiction`, authority y validity | Evitar promoción indebida de evidencia. |
| `limitations`, `contradictions`, `missing_evidence` | Conservar incertidumbre y restricciones. |
| `content_sha256` cuando haya bytes o snapshot canónico | Detectar drift/corrupción; no sustituye una firma o autorización. |

Un provenance incompleto degrada el artefacto a no autoritativo o lo rechaza, según el contrato. Nunca se rellena con valores inventados.

## Derechos de productor y consumidor

| Operación | Productor owner | Consumidor |
|---|---:|---:|
| Crear o cambiar entidad autoritativa | Sí | No |
| Emitir una nueva versión | Sí | No |
| Conservar foreign ID + producer | Sí | Sí |
| Guardar snapshot recibido para audit | Sí | Sí, con versión/provenance y política de retención |
| Anotar decisión local basada en el snapshot | Sí | Sí, dentro de su propio agregado |
| Corregir la fuente del productor | Sí | No; envía request/gap separado |
| Declarar autoridad o aprobación del otro producto | No | No |

## Consistencia e intercambio

- No hay sincronización bidireccional genérica.
- No hay “last write wins” entre productos.
- Requests mutables requieren idempotency key; replays compatibles devuelven el mismo resultado y reuso conflictivo falla.
- Los consumidores toleran entrega repetida y orden fuera de secuencia usando ID, versión y tiempo.
- La ausencia temporal del productor no autoriza al consumidor a editar una copia local como verdad.
- Un cache debe conservar origen/versión, tener política de expiración y no ocultar revocation/supersession conocida.
- Las correcciones se publican como nueva versión o evento explícito; nunca se reescribe silenciosamente un snapshot ya intercambiado.

## Autoridad y jurisdicción documental

Ownership técnico no equivale a autoridad jurídica. LA Muni RAG es owner del registro y su evaluación de metadata, pero la autoridad proviene de la entidad publicadora y el marco aplicable.

Se mantienen separados:

- `source_jurisdiction` y `target_jurisdiction`;
- `official_source` y `official_for_target_jurisdiction`;
- authority class/level y evidence status;
- fecha de publicación, vigencia y tiempo de adquisición.

Por ejemplo, un manual oficial de Mixco sigue siendo `external_reference`/comparativo para Antigua hasta corroboración aplicable.

## Estado actual y gaps de enforcement

- La DB actual no contiene `tenant_id` ni políticas RLS transversales.
- `EvidenceItem` y `ProcedureEvidenceBundle` actuales no cargan toda la identidad, versión y provenance exigida por esta política.
- `ProcedureWorkflow` actual no tiene lifecycle/version/approval canónico.
- Los endpoints `/api/*` actuales no implementan `schema_version`, idempotency o errores públicos uniformes.
- No existen JSON Schemas/OpenAPI/contract tests de intercambio con los productos vecinos.

Estas diferencias son gaps de implementación; no reducen la política. Deben cerrarse en los workstreams de identidad, procedimiento e integración antes de declarar production-ready.

## Documentos relacionados

- [Contextos delimitados](./bounded-contexts.md)
- [Contexto del sistema](./system-context.md)
- [Límites del producto](../product/product-boundaries.md)
- [Contratos entre productos](../integrations/contracts.md)
- [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md)
