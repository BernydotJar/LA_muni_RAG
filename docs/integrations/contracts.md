# Contratos entre productos

Estado: foundation v1; providers `ClaimPack`, `EvidenceBundle`, `ProcedureWorkflow`,
`ProcedureAssessment` y API operacional de ingestion jobs implementados; consumers y demás artifacts pendientes

Fecha de corte: 2026-07-21

## Alcance

Este documento define la semántica común para integrar LA Muni RAG, OS Electoral y Content Agency sin compartir storage. Los artifacts canónicos están en [`contracts/schemas/v1`](../../contracts/schemas/v1), [`contracts/openapi/v1/openapi.json`](../../contracts/openapi/v1/openapi.json) y [`contracts/examples/v1`](../../contracts/examples/v1). La ruta `POST /api/v1/procedure-queries` implementa los slices provider de `EvidenceBundle` y `ProcedureWorkflow`. La ruta separada `POST /api/v1/claim-packs` acepta únicamente un request de Content Agency y entrega claims/citations/usage bounds sin producir contenido. Sus validaciones y smoke desechables no demuestran interoperabilidad con consumers vecinos ni despliegue productivo. El mismo registry contiene los contratos operacionales cerrados `IngestionJobRequest` y `IngestionJobResponse` para `POST/GET /api/v1/ingestion-jobs`; no son artifacts cross-product ni un API de upload.

La decisión de arquitectura está en [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md) y el ownership en [Ownership de datos](../architecture/data-ownership.md).

## Catálogo de payloads

| Payload | Product owner | Producer -> consumer | Propósito | Estado al corte |
|---|---|---|---|---|
| `ProcedureQueryRequest` | OS Electoral | OS Electoral -> LA Muni RAG | Solicitar inteligencia procedimental con jurisdiction y case context. | Provider HTTP implementado para bundle, workflow y assessment; consumer OS Electoral pendiente. |
| `EvidenceGapRequest` | OS Electoral (request); LA Muni RAG (investigación resultante) | OS Electoral -> LA Muni RAG | Solicitar localización/validación de evidencia faltante. | Schema y ejemplo implementados; endpoint/adapter pendientes. |
| `EvidenceBundle` | LA Muni RAG | LA Muni RAG -> OS Electoral | Entregar claims/citations/contradictions/gaps de una consulta. | Mapper/provider y conflicto explícito de versiones implementados con identidades document/version/section; corpus completo, semantic conflicts, lifecycle de resolución y consumer pendientes. |
| `ProcedureWorkflow` | LA Muni RAG | LA Muni RAG -> OS Electoral | Entregar workflow y versión con autoridad/aprobación explícitas. | Mapper/provider draft-only implementado y validado; lifecycle/versioning persistente y aprobación humana ausentes. |
| `ProcedureAssessment` | LA Muni RAG | LA Muni RAG -> OS Electoral | Evaluar conservadoramente case context contra el draft generado. | Mapper/provider/replay/OpenAPI/eval implementados; case binding, consumer y persistencia de assessment pendientes. |
| `ApprovedCommunicationBrief` | OS Electoral | OS Electoral -> Content Agency | Entregar decisión comunicacional aprobada y evidence refs. | Boundary documentado aquí; no pertenece al runtime de LA Muni RAG. |
| `ClaimPack` | LA Muni RAG | LA Muni RAG -> Content Agency | Entregar claims citables y límites de uso. | Provider HTTP local, exact replay, expiry, boundary y eval implementados; consumer Content Agency pendiente. |
| `ContentPackage` | Content Agency | Content Agency -> OS Electoral | Entregar artefactos/risk/Greenlight/publication/performance. | Boundary documentado aquí; no pertenece al runtime de LA Muni RAG. |

Los campos de dominio de cada flujo están en [OS Electoral](./os-electoral.md) y [Content Agency](./content-agency.md).

## Forma común v1

Cada payload debe ser un objeto cerrado (`additionalProperties: false`) y portar o estar envuelto por metadata equivalente a:

```json
{
  "schema_version": "v1",
  "event_id": "00000000-0000-4000-8000-000000000000",
  "event_version": "1.0.0",
  "event_name": "procedure.query.completed",
  "direction": "outbound",
  "occurred_at": "2026-07-18T00:00:00Z",
  "tenant_id": "00000000-0000-4000-8000-000000000001",
  "request_id": "00000000-0000-4000-8000-000000000002",
  "actor_credential_id": "00000000-0000-4000-8000-000000000003",
  "audit_id": "00000000-0000-4000-8000-000000000004",
  "subject_id": "procedure-water-antigua",
  "payload_type": "procedure_workflow",
  "payload": {},
  "provenance": {}
}
```

El schema `event-envelope.schema.json` es normativo. El fragmento omite deliberadamente el payload y provenance completos; los ejemplos válidos canónicos, no este fragmento abreviado, se usan para conformance.

### Campos comunes

| Campo | Regla |
|---|---|
| `schema_version` | Major contract cerrado, inicialmente `v1`; no se negocia por heurística. |
| `event_id` | UUID único y estable para dedupe/audit del evento. |
| `event_version` | SemVer de la forma del evento, separado del major `schema_version`. |
| `event_name` | Nombre cerrado por pattern y semántica de dominio. |
| `direction` | `inbound`, `outbound` o `internal`. |
| `tenant_id` | UUID de scope obligatorio para datos protegidos; no es credencial. |
| `occurred_at` | UTC RFC 3339/OpenAPI `date-time`. |
| `request_id` | Correlación end-to-end sin PII o secreto. |
| `actor_credential_id` / `audit_id` | Referencias UUID; nunca incluyen el secreto Bearer. |
| `subject_id` | ID opaco seguro del sujeto de dominio. |
| `payload_type` / `payload` | Discriminador cerrado y objeto validado por su schema específico. |
| `provenance` | Producer, actor de generación, tiempo y refs verificables. |

## JSON Schema y OpenAPI

### Estructura de versioning

- Cada schema tiene `$id` estable con major version y title único.
- `$schema` se fija a JSON Schema draft 2020-12 y Ajv valida en modo `strict`/`allErrors` con formats.
- OpenAPI referencia los mismos componentes o genera artifacts verificados contra ellos; no se mantienen dos semánticas manuales divergentes.
- La ruta pública usa `/api/v1/...`; `schema_version` sigue siendo obligatorio para detectar payloads fuera de contrato.
- Schemas cierran enums, formatos y campos desconocidos.
- Ejemplos no reemplazan validation ni contract tests.

### Política de compatibilidad

| Cambio | Versión requerida |
|---|---|
| Agregar campo opcional sin cambiar semántica | Compatible dentro de `v1`, sólo tras consumer verification. |
| Agregar valor a enum cerrado | Breaking para consumidores exhaustivos; nuevo major salvo negociación explícita. |
| Hacer obligatorio un campo, cambiar tipo o significado | Nuevo major. |
| Quitar/renombrar campo o cambiar ownership | Nuevo major y ADR/migration plan. |
| Nueva versión de procedure/workflow/document | No cambia schema; cambia domain version/ref. |

Un período de deprecation debe indicar owner, fecha de retiro, consumer inventory y evidencia de migración. No se cambia `v1` silenciosamente.

## IDs y referencias

- Los IDs son strings opacos; el schema establece longitud/pattern seguro sin codificar autorización.
- Todas las foreign refs incluyen product owner, resource type, ID y versión cuando el recurso es versionado.
- `workflow_id` identifica lineage y `workflow_version` el snapshot.
- `document_id` y `document_version_id` no se sustituyen por title/URL.
- `claim_pack_id`, `evidence_bundle_id` y `assessment_id` identifican snapshots generados.
- El consumer persiste la referencia exacta usada por su decisión/artefacto.

## Idempotencia

Toda operación POST que cree una solicitud, gap o artifact exige `Idempotency-Key` en el transporte:

```text
scope = producer + tenant_id + operation + key
fingerprint = hash(canonical request payload)
```

- Replay con mismo scope/fingerprint devuelve status/body/IDs originales dentro de la retención definida.
- Mismo scope/key con fingerprint distinto devuelve conflicto estructurado.
- El key no se reutiliza entre tenants u operaciones.
- Un retry por timeout usa el mismo key; no genera una copia “por si acaso”.
- El receipt y audit conservan key hash/ID seguro, correlation y resultado sin cuerpo sensible.

## Provenance de dominio

Además del envelope, los payloads deben conservar:

- query/request y versiones de inputs;
- jurisdiction y authority status;
- citations que resuelven a document/section versions;
- generation/retrieval time y producer version cuando sea útil;
- contradictions, missing evidence, gaps y limitations;
- approval status y decisión/version exacta cuando se afirme aprobación;
- hash de bytes/snapshot canónico cuando corresponda.

Un cliente nunca puede completar un campo de provenance faltante inventándolo. El provider rechaza o degrada de manera explícita.

## Errores

El contrato v1 usa un error seguro y versionado:

```json
{
  "schema_version": "v1",
  "response_type": "api_error",
  "tenant_id": null,
  "request_id": "00000000-0000-4000-8000-000000000002",
  "audit_id": "00000000-0000-4000-8000-000000000004",
  "http_status": 401,
  "retryable": false,
  "error": {
    "code": "unauthorized",
    "message": "Authentication required",
    "details": []
  },
  "provenance": {}
}
```

En `401`, tenant y credential son `null`; inventarlos sería un fallo de seguridad. En `403`, ambos son UUID ya autenticados y la respuesta se fija a `forbidden` / `Access denied` / `[]`, igual para permiso y tenant mismatch.

Códigos y status están cerrados por schema/OpenAPI. El provider procedural y el
API de ingestion implementados cubren schema estricto, authn/authz/tenant,
igualdad de request IDs, boundary aplicable, replay/conflicto, rate limit, CORS
exacto y errores seguros. Ingestion status implementa `404` uniforme para un job
missing o cross-tenant. Todavía faltan escenarios de recursos versionados que
estos slices no exponen:

- document/version superseded o expired sin metadata leakage;
- insufficient evidence y ambiguous jurisdiction;
- superseded/expired artifact;
- consumer timeout/retry end-to-end.

`details` no devuelve valores sometidos, secrets, existencia cross-tenant, prompts completos ni stack traces.

## Seguridad y privacidad

- La integration identity se verifica fuera del body; `producer` y `tenant_id` declarados no son confiables por sí solos.
- Authorization se aplica por action, tenant y resource antes de materializar respuesta.
- Rate limits y body bounds anteceden ejecución costosa.
- Logs minimizan question/case context/claims; audit conserva IDs, hashes, actor, action, time y outcome.
- Content clasificado/confidencial no cruza de producto sin policy explícita.
- CORS o network reachability no reemplaza authn/authz.

Estas reglas están implementadas para `POST /api/v1/procedure-queries` y la
familia `POST/GET /api/v1/ingestion-jobs`, con permisos y payloads distintos. No
están implementadas transversalmente para todo el catálogo ni para consumers
externos. Las rutas pre-v1 quedan deshabilitadas por defecto con
`NODE_ENV=production`; en desarrollo siguen siendo código legacy no tenant-aware.

## Transportes permitidos

### HTTP

OpenAPI v1 es autoritativo para rutas, métodos, headers, status codes y modelos. TLS, identity, authorization, pagination/rate limit e idempotency se aplican según operación.

### Sandbox/file-based

Sólo se permite como harness o adapter temporal si:

- serializa exactamente el mismo envelope/payload validado por JSON Schema;
- usa directorios de intercambio explícitos, no el storage interno del productor;
- registra receipt, hash y provenance;
- no se monitorea como sync bidireccional ni permite writes a agregados del otro producto.

El transporte temporal no cambia ownership ni semántica.

## Contract tests requeridos

| Suite | Casos mínimos |
|---|---|
| Schema conformance | Valid payload, required fields, unknown fields, enum/date/ID constraints, incompatible major. |
| Provider | Auth/tenant, success, no evidence, boundary refusal, expired/superseded refs, structured errors. |
| Consumer | Conserva IDs/versiones/provenance, tolera campos opcionales, no promueve drafts/comparative evidence. |
| Idempotency | Exact replay, conflicting replay, concurrent duplicate y timeout retry. |
| Isolation | Cross-tenant ID/request negado sin metadata leakage y con audit. |
| OS integration | Query -> bundle/workflow/assessment sin campaign strategy. |
| Content integration | ClaimPack -> evidence refs conservadas sin copy/publication en LA Muni RAG. |

Cada test debe ejecutar los artifacts machine-readable canónicos, no una copia manual del tipo.

## Estado y gaps verificables

Al corte:

- existen dieciséis schemas draft 2020-12, dieciséis ejemplos y un OpenAPI 3.1.1 con los providers implementados y límites explícitos;
- `npm run contracts:validate` valida el registry completo con Ajv; los handlers vuelven a validar sus requests, `ClaimPack`, `EvidenceBundle`, `ProcedureWorkflow`, `ProcedureAssessment`, `IngestionJobResponse` y `ApiError` en runtime;
- pruebas focales cubren igualdad header/body, identidad/tenant/RBAC, boundary, CORS, public-only retrieval, conflicto explícito de versiones y anti-falsos-positivos, ClaimPack abstention/no-promotion/expiry, replay/conflicto de idempotencia/corrupción, ingestion new/dedup/status/404, rate limit y rutas legacy cerradas en producción;
- gates desechables históricos sobre PostgreSQL 16.14/pgvector 0.8.5 y roles no propietarios ejecutaron migraciones/aislamiento A/B; el smoke procedural actualizado espera `200/200/409/403/400/401/500/200/200/200` incluyendo bundle/replay, pero su ejecución para el HEAD actual está pendiente de CI remoto; el smoke ingestion `401/403/403/202/200/202/409/429/200/404/404`;
- los gates PostgreSQL/HTTP de ClaimPack están cableados, pero la imagen pgvector fijada no pudo registrarse en el sandbox actual y el HEAD requiere CI remoto;
- el catálogo mínimo completo de `/api/v1/*` todavía no implementa transversalmente estas reglas;
- el control plane v1 observado de Content Agency es su API interna de misiones/runs/approvals, no este contrato;
- los contratos read-only observados de OS Electoral son internos a sus bounded contexts, no este contrato.

Por tanto, “provider local probado” no equivale a “integración operativa”.
Persistencia, idempotencia y aislamiento están probados para estos slices en una
base desechable; el worker de ingestion no está desplegado y carece de adapter
storage/scanner. También faltan el consumer de OS Electoral, pruebas entre
repositorios, los demás artifacts/endpoints, lifecycle humano, staging y
despliegue.

## Documentos relacionados

- [Integración con OS Electoral](./os-electoral.md)
- [Integración con Content Agency](./content-agency.md)
- [Contexto del sistema](../architecture/system-context.md)
- [Límites del producto](../product/product-boundaries.md)
