# Visión de inteligencia procedimental

Estado: visión de producto aprobada; entrega production-ready aún no alcanzada  
Fecha de corte: 2026-07-18

## Resultado buscado

LA Muni RAG debe permitir que una persona pase de una pregunta municipal a una respuesta verificable y, cuando la consulta sea procedimental, a una definición estructurada que pueda revisarse y seguirse sin ocultar incertidumbre.

```text
pregunta
  -> clasificación y jurisdicción
  -> evidencia recuperada
  -> citas, autoridad, vigencia y contradicciones
  -> procedimiento/workflow en draft
  -> revisión humana y versión aprobada
  -> caso procedimental y seguimiento documental
```

La misión no es automatizar decisiones institucionales ni producir una narrativa segura de sí misma. Es convertir evidencia disponible en conocimiento procedimental auditable y mostrar con igual claridad lo que todavía no está respaldado.

## Pregunta de producto

> Con base en las fuentes disponibles, ¿cuál es el procedimiento aplicable para realizar X, qué pasos tiene, quién participa, qué documentos se requieren, qué decisiones existen, qué evidencia respalda cada paso y qué información todavía falta?

## Objetos conceptuales

| Objeto | Significado | Invariante |
|---|---|---|
| Fuente | Origen identificado de un documento o dato documental. | Su autoridad, jurisdicción, estado de adquisición y provenance son explícitos. |
| Documento | Obra o instrumento registrado de forma estable. | No se confunde con una versión binaria concreta. |
| Versión documental | Snapshot inmutable con hash y metadatos de extracción. | Citas y secciones apuntan a una versión identificable. |
| Evidencia | Fragmento recuperado con cita y contexto de autoridad. | No se promueve una inferencia a hecho respaldado. |
| Procedimiento | Definición institucional versionable de cómo realizar X. | Distingue jurisdicción, lifecycle y evidencia por paso. |
| Workflow | Representación ejecutable/revisable de un procedimiento. | Toda generación de IA comienza como `draft`; aprobación humana es separada. |
| Caso procedimental | Instancia de seguimiento ligada a una versión concreta. | No incorpora estrategia electoral ni producción de contenido. |
| Gap | Información, documento o regla pendiente. | Se conserva visible hasta localizarse y validarse. |

## Principios del producto

### Evidencia antes que fluidez

Una respuesta útil conserva citas, authority class, jurisdicción, versión documental y limitaciones. Ante evidencia insuficiente, debe responder con un gap o rechazo estable en vez de completar datos plausibles.

### Antigua primero, comparación explícita

Las fuentes de Antigua Guatemala y la normativa nacional aplicable pueden respaldar el procedimiento objetivo según su autoridad y vigencia. Una fuente oficial de Mixco puede ser oficial para Mixco y comparativa para Antigua; nunca define por sí sola el procedimiento de Antigua. La advertencia comparativa debe viajar con la evidencia.

### Versiones inmutables y decisiones humanas

Documentos, procedimientos y workflows evolucionan mediante nuevas versiones. Una versión aprobada no se modifica en sitio. El lifecycle objetivo es:

```text
draft -> in_review -> approved -> superseded -> archived
```

La existencia de ese lifecycle es un objetivo; el baseline actual todavía no lo persiste de extremo a extremo.

### Incertidumbre tipada

Cada paso objetivo distingue:

```text
supported
inferred_for_review
comparative_reference
missing_evidence
not_applicable
```

Los tipos actuales del MVP usan `supported`, `inferred` e `insufficient`; la convergencia al lifecycle y estados anteriores sigue pendiente.

### Separación entre conocimiento y acción externa

LA Muni RAG produce evidencia, procedimientos y evaluaciones documentales. OS Electoral convierte esos artefactos en decisiones de campaña. Content Agency convierte briefs aprobados y claim packs en artefactos de contenido. Esta separación se define en [Límites del producto](./product-boundaries.md).

### Auditabilidad y provenance

Toda afirmación material debe poder reconstruirse desde el artefacto consumido hasta las citas, secciones, versiones documentales, hashes y fuente. Toda transformación debe identificar producer, versión de schema, tiempo, inputs y limitaciones. Véase [Ownership de datos](../architecture/data-ownership.md).

## Golden use case: agua potable

La prueba principal es:

> ¿Qué se necesita para llevar agua potable a una comunidad de Antigua Guatemala y cómo se le da seguimiento?

El sistema objetivo investiga y estructura necesidad, solicitud, participación COCODE/COMUDE, planificación, estudios, fuente y calidad de agua, terreno/servidumbres, presupuesto e inversión, ambiente/salud, dictámenes, Concejo, expediente, contratación, ejecución, recepción, operación, mantenimiento y continuidad.

Esas son categorías de investigación, no hechos ni pasos predeterminados. Por cada categoría el sistema debe:

- citar evidencia aplicable a Antigua o normativa nacional pertinente;
- marcar referencias externas como comparativas;
- evitar inventar formulario, sistema, actor, aprobación o plazo;
- registrar “Documento o regla pendiente de localizar y validar” cuando corresponda;
- producir un workflow estructurado, no sólo una respuesta narrativa.

El corpus y eval end-to-end requeridos para demostrar este caso todavía no están completos según la [auditoría de baseline](../../program/baseline-audit.md).

## Capacidades objetivo

1. **Document Intelligence:** registro, adquisición, versiones, SHA-256, extracción estructural, secciones, tablas, forms, chunks, embeddings, jobs y auditoría.
2. **Evidence Retrieval:** keyword, phrase, semantic e hybrid, filtros de autoridad/tenant/jurisdicción/vigencia/confidencialidad, contradicciones, groundedness y citas.
3. **Procedural Knowledge:** procedimientos, versiones, pasos, actores, documentos, gates, legal basis, plazos, criterios de cierre, riesgos, estados de evidencia y gaps.
4. **Workflow Compilation:** clasificación, grafo de dependencias, drafts exportables, revisión y aprobación humana.
5. **Procedural Case Tracking:** progreso y expediente documental ligados a una versión aprobada.
6. **Integration APIs:** artefactos versionados para OS Electoral y Content Agency sin compartir storage.

## Estado real y siguiente frontera

El repository actual ya demuestra slices de inventario, hashing, ingestión local, extracción, búsqueda y workflow composition. No demuestra todavía autenticación/tenancy integral, API pública v1, procedimiento versionado con aprobación, casos server-side, hard evals, integraciones externas ni operación production-grade.

La arquitectura objetivo está descompuesta en [Contextos delimitados](../architecture/bounded-contexts.md), el sistema y sus actores en [Contexto del sistema](../architecture/system-context.md), y la decisión de no-superposición en [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md).

## Señal de éxito

La visión se considera realizada sólo cuando una consulta procedimental puede producir un artefacto versionado y citable, someterlo a revisión humana, crear un caso ligado a la versión aprobada y compartirlo mediante un contrato validado, manteniendo gaps y límites de autoridad visibles. Una demo estática o un workflow sintético no basta.
