# Contratos entre productos

Estado: foundation machine-readable v1 implementada; providers/consumers runtime pendientes

Fecha de corte: 2026-07-18

## Alcance

Este documento define la semántica común para integrar LA Muni RAG, OS Electoral y Content Agency sin compartir storage. Los artifacts canónicos están en [`contracts/schemas/v1`](../../contracts/schemas/v1), [`contracts/openapi/v1/openapi.json`](../../contracts/openapi/v1/openapi.json) y [`contracts/examples/v1`](../../contracts/examples/v1). Su validación demuestra conformidad de schema, no interoperabilidad runtime ni compatibilidad de un consumer vecino.

La decisión de arquitectura está en [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md) y el ownership en [Ownership de datos](../architecture/data-ownership.md).

## Catálogo de payloads

| Payload | Product owner | Producer -> consumer | Propósito | Estado al corte |
|---|---|---|---|---|
| `ProcedureQueryRequest` | OS Electoral | OS Electoral -> LA Muni RAG | Solicitar inteligencia procedimental con jurisdiction y case context. | Schema, ejemplo y OpenAPI v1 implementados; provider/consumer pendientes. |
| `EvidenceGapRequest` | OS Electoral (request); LA Muni RAG (investigación resultante) | OS Electoral -> LA Muni RAG | Solicitar localización/validación de evidencia faltante. | Schema y ejemplo implementados; endpoint/adapter pendientes. |
| `EvidenceBundle` | LA Muni RAG | LA Muni RAG -> OS Electoral | Entregar claims/citations/contradictions/gaps de una consulta. | Schema y ejemplo implementados; mapper/provider pendientes. |
| `ProcedureWorkflow` | LA Muni RAG | LA Muni RAG -> OS Electoral | Entregar workflow y versión con autoridad/aprobación explícitas. | Schema y ejemplo implementados; lifecycle/versioning persistente ausente. |
| `ProcedureAssessment` | LA Muni RAG | LA Muni RAG -> OS Electoral | Evaluar case context contra requisitos de una procedure version. | Schema y ejemplo implementados; assessment service ausente. |
| `ApprovedCommunicationBrief` | OS Electoral | OS Electoral -> Content Agency | Entregar decisión comunicacional aprobada y evidence refs. | Boundary documentado aquí; no pertenece al runtime de LA Muni RAG. |
| `ClaimPack` | LA Muni RAG | LA Muni RAG -> Content Agency | Entregar claims citables y límites de uso. | Schema y ejemplo implementados; provider/consumer pendientes. |
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

Códigos y status están cerrados por schema/OpenAPI; todavía faltan provider tests para varios escenarios:

- validation/unsupported schema;
- authentication/authorization/tenant scope;
- resource/version not found sin metadata leakage;
- insufficient evidence y ambiguous jurisdiction;
- product-boundary refusal;
- idempotency conflict;
- superseded/expired artifact;
- dependency unavailable y rate limited.

`details` no devuelve valores sometidos, secrets, existencia cross-tenant, prompts completos ni stack traces.

## Seguridad y privacidad

- La integration identity se verifica fuera del body; `producer` y `tenant_id` declarados no son confiables por sí solos.
- Authorization se aplica por action, tenant y resource antes de materializar respuesta.
- Rate limits y body bounds anteceden ejecución costosa.
- Logs minimizan question/case context/claims; audit conserva IDs, hashes, actor, action, time y outcome.
- Content clasificado/confidencial no cruza de producto sin policy explícita.
- CORS o network reachability no reemplaza authn/authz.

Estas reglas aún no están implementadas transversalmente en LA Muni RAG.

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

- existen nueve schemas draft 2020-12, nueve ejemplos, un OpenAPI 3.1.1 contract-only y doce contract tests de shape/boundary;
- `npm run contracts:validate` valida el registry completo con Ajv; la igualdad semántica entre headers/body y IDs duplicados queda para runtime;
- los endpoints actuales `/api/*` todavía no implementan transversalmente estas reglas comunes;
- `ProcedureEvidenceBundle` actual no cumple `EvidenceBundle`;
- el control plane v1 observado de Content Agency es su API interna de misiones/runs/approvals, no este contrato;
- los contratos read-only observados de OS Electoral son internos a sus bounded contexts, no este contrato.

Por tanto, “schema válido” no equivale a “integración operativa”. Faltan provider/consumer adapters, persistencia/idempotencia, aislamiento runtime y evidencia de los productos vecinos.

## Documentos relacionados

- [Integración con OS Electoral](./os-electoral.md)
- [Integración con Content Agency](./content-agency.md)
- [Contexto del sistema](../architecture/system-context.md)
- [Límites del producto](../product/product-boundaries.md)
