# Límites del producto

Estado: decisión aceptada; implementación de integraciones pendiente  
Fecha de corte: 2026-07-18  
Producto: Municipal Procedural Intelligence Platform (`BernydotJar/LA_muni_RAG`)

## Propósito de este documento

Este documento fija qué producto decide, almacena y modifica cada clase de información. Es una regla de diseño y de priorización, no una afirmación de que todas las capacidades descritas ya existan. El estado ejecutable real sigue siendo parcial y está resumido en la [auditoría de baseline](../../program/baseline-audit.md).

La decisión formal, incluidas sus consecuencias, está en [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md). Los contratos de intercambio se detallan en [Contratos entre productos](../integrations/contracts.md).

## Identidad y resultado propio

LA Muni RAG convierte fuentes verificables en documentos versionados, evidencia citable y procedimientos estructurados que pueden revisarse, aprobarse y usarse para seguimiento documental. Su pregunta propia es:

> Con base en las fuentes disponibles, ¿cuál es el procedimiento aplicable, qué evidencia respalda cada paso y qué falta por localizar o validar?

La cadena de valor que pertenece al producto es:

```text
fuente -> documento -> versión -> sección -> evidencia
       -> respuesta RAG -> procedimiento -> workflow versionado
       -> instancia procedimental -> seguimiento documental
```

## Mapa de ownership

| Producto y repository owner | Es source of truth para | No es source of truth para |
|---|---|---|
| **LA Muni RAG** — [`BernydotJar/LA_muni_RAG`](https://github.com/BernydotJar/LA_muni_RAG) | Fuentes, documentos y versiones; autoridad, jurisdicción y vigencia documental; secciones, evidencia y citas; definiciones/versiones de procedimientos; pasos y fuentes por paso; drafts, revisión y aprobación de workflows; casos procedimentales y gaps de evidencia. | Campañas, estrategia electoral, territorio electoral, segmentos, operaciones de campo, briefs de contenido, piezas, publicación o performance de contenido. |
| **OS Electoral** — [`BernydotJar/OS-Electoral`](https://github.com/BernydotJar/OS-Electoral) | Campañas y charters; estado y compuertas estratégicas; decisiones, objetivos, territorio, segmentos, propuestas, compromisos, operaciones, aprobaciones y riesgos electorales. | Corpus jurídico municipal, ingestión legal, declaración de autoridad documental, definición o modificación de procedimientos oficiales, producción y publicación de contenido. |
| **AI-Native Content Agency SaaS** — [`BernydotJar/AI-Native-Content-Agency-SaaS`](https://github.com/BernydotJar/AI-Native-Content-Agency-SaaS) | Misiones/briefs de contenido, corridas, artefactos, copy y media packs, experimentos de distribución, decisiones Greenlight, intentos/recibos de publicación y aprendizaje de performance. | Estrategia política principal, campaña o territorio; corpus jurídico; autoridad de una fuente; definición o aprobación de procedimientos oficiales. |

Un consumidor puede conservar un identificador externo y una copia inmutable de intercambio con provenance. Esa copia no le transfiere ownership ni autorización para modificar la entidad original. Véase [Ownership de datos](../architecture/data-ownership.md).

## Regla de clasificación previa

Toda capacidad nueva se clasifica antes de diseñarse:

```text
¿Conocimiento documental, evidencia o procedimiento?
  -> LA Muni RAG

¿Decisión, estrategia, territorio u operación electoral?
  -> OS Electoral

¿Producción, adaptación, revisión o distribución de contenido?
  -> AI-Native Content Agency SaaS
```

Si la capacidad pertenece a otro producto, LA Muni RAG:

1. no crea una implementación local equivalente;
2. conserva únicamente referencias externas necesarias;
3. intercambia artefactos mediante API versionada o payload validado por schema;
4. no consulta ni escribe directamente la base de datos vecina;
5. añade adapter y contract tests sólo cuando exista una integración aprobada;
6. mantiene visible el repository owner y el provenance del artefacto.

## Alcance positivo de LA Muni RAG

El producto puede evolucionar dentro de estos límites:

- inventario, adquisición controlada, hashing, versionado y extracción documental;
- secciones estructurales, chunking, embeddings e índices;
- recuperación keyword, phrase, semantic e hybrid con autoridad y citas;
- contradicciones, gaps y rechazo cuando la evidencia sea insuficiente;
- modelado de procedimientos, actores, documentos, decisiones, plazos y bases legales;
- compilación de workflows siempre iniciados como `draft`;
- revisión humana, aprobación, supersession y archivo de versiones;
- casos procedimentales para avance, documentos, blockers y audit trail;
- APIs de evidencia, procedimientos y gaps de evidencia.

Estos puntos son alcance objetivo. No todos están implementados hoy.

## Exclusiones obligatorias

LA Muni RAG no implementa:

- estrategia, dirección, segmentación, movilización o CRM electoral;
- objetivos de campaña, message house, paid media o war room;
- calendario editorial, growth experiments o generación masiva de contenido;
- producción multimedia, publicación social o campaign analytics;
- alteración local de una decisión o agregado cuyo owner sea otro producto.

Una solicitud como “diseña la estrategia electoral y el calendario de contenido” debe identificar a OS Electoral y Content Agency como owners. LA Muni RAG sólo puede devolver evidencia o apoyo procedimental relevante y debe evitar presentar ese apoyo como decisión estratégica o contenido producido.

## Reglas de no-superposición

| Situación | Comportamiento permitido | Comportamiento prohibido |
|---|---|---|
| OS Electoral evalúa una propuesta municipal | Consumir un `EvidenceBundle`, `ProcedureWorkflow` o `ProcedureAssessment` versionado. | Copiar el corpus o editar el workflow como si fuera propio. |
| OS Electoral detecta información faltante | Enviar un `EvidenceGapRequest`; LA Muni RAG valida la fuente antes de promoverla. | Declarar oficial una fuente no validada. |
| Content Agency usa una afirmación jurídica | Consumir un `ClaimPack` y preservar IDs/citas/limitaciones. | Generar o publicar la afirmación sin evidencia enlazada. |
| LA Muni RAG recibe contexto de campaña | Guardar IDs externos mínimos como referencias de una consulta o caso. | Replicar campaña, segmentos, presupuesto, calendario o field operations. |
| Un contrato cambia | Publicar una nueva versión compatible o un nuevo major version. | Cambiar silenciosamente la semántica de un payload existente. |

## Estado real al corte

- **LA Muni RAG:** tiene registro/versiones PostgreSQL, inventario de fuentes, adquisición e ingestión local controlada, extracción, retrieval keyword/phrase/hybrid, citas y un compositor preliminar de workflows. Sus endpoints actuales son `/api/*`, no una API externa `/api/v1`; no hay tenancy/RBAC integral, lifecycle persistente de procedimientos, casos server-side ni contratos externos implementados.
- **OS Electoral:** su repository declara ownership de campaign workspace, candidate brand, approval ledger y operaciones. La evidencia inspeccionada describe contratos de consulta internos y aislamiento de alcance, pero las capas siguen draft/human-blocked y no existe un adapter de LA Muni RAG.
- **Content Agency:** tiene un control plane local HTTP v1 para misiones, corridas y Greenlight sandbox. La identidad de headers es sólo desarrollo; publicación externa, staging y producción no están disponibles. Su OpenAPI actual no incluye `ClaimPack` ni una integración con LA Muni RAG.

Por ello, los flujos de [OS Electoral](../integrations/os-electoral.md) y [Content Agency](../integrations/content-agency.md) son contratos objetivo pendientes de implementación en WS-08, no integraciones operativas.

## Criterio de aceptación de boundary

Una entrega respeta este límite cuando:

- cada entidad tiene un solo owner explícito;
- ningún producto vecino comparte tablas o credenciales de base de datos;
- toda copia consumida conserva ID, versión, producer y provenance;
- un consumidor no puede promover ni editar la verdad del productor;
- las capacidades ausentes se presentan como gaps, no como disponibles;
- EVAL-BOUNDARY-001 y los contract tests correspondientes pasan antes de declarar integración lista.

## Documentos relacionados

- [Visión de inteligencia procedimental](./procedural-intelligence-vision.md)
- [Contextos delimitados](../architecture/bounded-contexts.md)
- [Contexto del sistema](../architecture/system-context.md)
- [Ownership de datos](../architecture/data-ownership.md)
- [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md)
- [Contratos entre productos](../integrations/contracts.md)
