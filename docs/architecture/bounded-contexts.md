# Contextos delimitados

Estado: arquitectura objetivo aceptada; implementación desigual  
Fecha de corte: 2026-07-19

## Cómo leer este mapa

Cada contexto representa una frontera semántica y de ownership dentro de LA Muni RAG. La tabla separa responsabilidad objetivo de evidencia actual para no presentar diseño futuro como capacidad disponible. Los owners externos se describen en [Límites del producto](../product/product-boundaries.md).

Estados usados:

- **parcial:** existe código o esquema útil, pero faltan invariantes del contexto;
- **ausente:** no existe una implementación equivalente verificable;
- **objetivo:** regla arquitectónica que debe gobernar la implementación futura.

## Mapa interno

| Contexto | Responsabilidad y datos propios | Evidencia actual | Estado al corte |
|---|---|---|---|
| **Source Catalog** | `source_id`, ubicación, autoridad, jurisdicción, vigencia, estado de adquisición, provenance y gaps. | `.rag/source-inventory.json`, validación de autoridad y operaciones locales de biblioteca. Persisten fuentes no adquiridas; la auditoría registró una contradicción PDM-OT cuya reconciliación requiere evidencia verificable. | parcial |
| **Document Intelligence** | Documento estable, versiones inmutables, hash, bytes, extracción, secciones, chunks, embeddings e ingestion jobs. | Esquema PostgreSQL `rag.*`, extractores, manifest, SHA-256, CLI local, API autenticada de enqueue/status y worker callable sobre núcleo durable tenant-scoped con leases, retry, fencing y reemplazo vectorial atómico. Sin biblioteca/upload autenticado, worker desplegado, adapter storage/scanner durable ni operación production-grade. | parcial |
| **Evidence Retrieval** | Consultas, candidatos, ranking, evidence items, citas, contradicciones, gaps y decisión de insuficiencia. | Keyword/phrase tenant-safe en v1, hybrid local, citas y `not_found`; el repositorio vectorial tenant-safe existe pero no está conectado al endpoint v1. Faltan evaluación grounded sobre corpus real, conflictos/version awareness y operación vectorial aprobada. | parcial |
| **Procedural Knowledge** | Definición y versión de procedimiento, pasos, actores, documentos, dependencias, gates, legal basis, authority y evidence status. | Tipos/compositor MVP y templates. Faltan persistencia, versión canónica, estados objetivo y golden workflow de agua. | parcial |
| **Workflow Governance** | Drafts, revisión, aprobación, supersession, archivo y audit de decisiones humanas. | Hay validación de templates y feedback controlado; no existe lifecycle persistente ni servicio de aprobación. | ausente |
| **Procedural Cases** | Caso ligado a `procedure_version_id`, paso actual, documentos, blockers, seguimiento y audit trail. | UI/localStorage de portfolio/workspace documentada como local-only; no es system of record. | ausente como contexto server-side |
| **Identity and Access** | Tenants, users, memberships, roles, credentials de integración, políticas y denial audit. | Modelo tenant/principal/membership/credential, diez roles, RLS forzado y transacción tenant-local; procedure-query v1, ingestion-job v1 y el núcleo de ingestión usan la frontera. Faltan catálogo completo de endpoints, provisioning/attestation productivo y control plane cross-tenant. | parcial |
| **Integration Gateway** | APIs v1, validación de schemas, idempotency, correlation, provenance, adapters y contract tests. | `POST /api/v1/procedure-queries` y `POST/GET /api/v1/ingestion-jobs`, once schemas/ejemplos, OpenAPI canónico, idempotency y providers locales están probados. Faltan consumidores externos autenticados, adapters restantes y worker/storage/scanner desplegados. | parcial |
| **Audit and Operations** | Eventos de auditoría, observabilidad, retención, backups, restore, incidentes y despliegue controlado. | Audit tenant-safe y sanitizado para consulta/ingestión, CI/runbooks y gates PostgreSQL no-owner locales. Faltan sink append-only central, retención, alertas, restore/HA/load y despliegue aprobado. | parcial |

## Relaciones y lenguaje compartido

```text
Source Catalog
  -> Document Intelligence
      -> Evidence Retrieval
          -> Procedural Knowledge
              -> Workflow Governance
                  -> Procedural Cases

Identity and Access -> todos los accesos y mutaciones
Audit and Operations <- eventos de todos los contextos
Integration Gateway -> proyecciones versionadas, nunca tablas internas
```

- **Source Catalog** decide si una fuente es identificada, verificada, comparativa, adquirida o faltante.
- **Document Intelligence** decide si bytes y extracción corresponden a una versión concreta; no decide autoridad jurídica por sí solo.
- **Evidence Retrieval** proyecta secciones como evidencia; no crea hechos ni cambia la fuente.
- **Procedural Knowledge** compone significado procedimental; no aprueba su propia salida generada.
- **Workflow Governance** es la única frontera que puede promover un draft tras revisión humana.
- **Procedural Cases** consume una versión, no la modifica.
- **Integration Gateway** traduce modelos internos a contratos públicos sin exponer storage.

## Agregados e invariantes objetivo

### Source

- `source_id` es estable y no se reutiliza.
- Jurisdicción de origen y jurisdicción objetivo son campos distintos.
- `official_source=true` no implica `official_for_target_jurisdiction=true`.
- `missing_source` nunca contiene evidencia falsa de adquisición o ingestión.

### Document

- `document_id` identifica la obra; `document_version_id` identifica un snapshot.
- Una versión adquirida conserva hash SHA-256 y provenance.
- Secciones y citas pertenecen a una versión, no sólo a un título.
- Un cambio de bytes crea o reconcilia una versión; no sobrescribe silenciosamente el hash.

### Evidence bundle

- Es una proyección inmutable de una consulta en un momento dado.
- Conserva jurisdiction, claims, citations, contradictions, missing evidence y limitations.
- Una citation debe permitir volver a la versión/sección productora.

### Procedure and workflow

- `procedure_id` mantiene identidad; cada revisión publicable tiene su propia versión.
- La salida de IA entra como `draft` y no puede autoaprobarse.
- Cada paso conserva evidence status y gaps; una referencia comparativa no se promueve.
- Una versión `approved` se reemplaza mediante supersession, no mediante mutación.

### Procedure case

- Se liga a una versión exacta y conserva sus propios eventos de avance.
- No puede cambiar la definición del procedimiento.
- IDs de campaña/comunidad pueden ser referencias externas, no copias de sus agregados.

## Contextos externos

| Contexto externo | Owner | Interacción permitida con LA Muni RAG |
|---|---|---|
| Campaign Workspace, Strategy, Territory, Approval Ledger y Daily Operations | OS Electoral | Solicitar evidencia/procedimiento y consumir snapshots versionados. Véase [Integración con OS Electoral](../integrations/os-electoral.md). |
| Mission, Content Run, Artifact, Greenlight, Publication y Performance | Content Agency | Consumir `ClaimPack` con citas/limitaciones; preservar refs. Véase [Integración con Content Agency](../integrations/content-agency.md). |
| Fuentes oficiales y repositorios documentales | Autoridad publicadora | Adquisición controlada con provenance; no se consideran API de producto vecina. |

## Anti-corruption layer

El [Integration Gateway](../integrations/contracts.md) es la capa anticorrupción. Debe:

- aceptar y emitir sólo contratos versionados;
- traducir snake_case público y tipos internos sin filtrar esquemas de DB;
- verificar tenant, authorization, schema y provenance;
- rechazar campos o acciones que invadan otro bounded context;
- usar IDs externos como referencias opacas;
- evitar transacciones distribuidas y sincronización bidireccional genérica.

## Decisiones relacionadas

- [Contexto del sistema](./system-context.md)
- [Ownership de datos](./data-ownership.md)
- [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md)
- [Visión de inteligencia procedimental](../product/procedural-intelligence-vision.md)
