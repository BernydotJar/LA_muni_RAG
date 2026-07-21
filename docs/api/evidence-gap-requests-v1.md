# EvidenceGapRequest API v1

Estado: provider implementado y verificado localmente; publicación, consumer
externo y deployment pendientes.

Fecha de corte: 2026-07-21

## Endpoint

```text
POST /api/v1/evidence-gap-requests
```

El endpoint registra una necesidad documental que OS Electoral no pudo resolver.
La respuesta sólo confirma un intake `open`; no confirma autoridad, vigencia,
aplicabilidad, adquisición, scan, ingestión ni resolución de una fuente.

## Required headers

```text
Authorization: Bearer <opaque credential>
Content-Type: application/json
X-Request-Id: <UUID igual a body.request_id>
Idempotency-Key: <16–128 allowlisted characters>
```

Authentication se completa antes de leer el body. La primera operación
post-authentication es el rate gate tenant/principal. Después se exige
`integration:query`, se valida el contrato cerrado y se comparan tenant y
credential provenance contra la identidad autenticada.

## Request y response

Request canónico:

```text
contracts/schemas/v1/evidence-gap-request.schema.json
```

Acknowledgement canónico:

```text
contracts/schemas/v1/evidence-gap-response.schema.json
```

`status` siempre es `open` y `request_assertion_status` siempre es
`requester_supplied_unverified` en v1. El provider conserva el request documental
acotado, una respuesta exacta validada, hashes y audit IDs. No ejecuta retrieval
ni compila un workflow.

## Idempotency y dedupe

Existen dos fronteras diferentes:

1. transport replay: tenant + principal + `Idempotency-Key` + request hash;
2. aggregate identity: tenant + `gap_request_id` y `request_id`.

Mismo key/payload devuelve bytes idénticos. El mismo aggregate con el mismo
payload bajo otra key devuelve la respuesta original. Cambiar payload con la
misma key produce `idempotency_conflict`; reutilizar aggregate identity con otro
payload produce `gap_request_conflict`.

Antes de replay, el handler comprueba status, SHA-256, JSON Schema, tenant,
request/gap IDs, credential/audit provenance y reconstrucción canónica. Bytes
corruptos o semántica no canónica se invalidan y nunca se emiten.

## Boundary

Se rechazan:

- estrategia, segmentación, targeting o movilización electoral;
- copy, contenido, calendarios o publicación;
- campos no contratados como `official_source` o `source_url`;
- instrucciones para declarar una fuente oficial, vigente o aplicable.

Una referencia de campaña es opaca y no altera prioridad documental, autoridad
jurídica ni estado del corpus.

## Persistence y RLS

Migration:

```text
db/migrations/012_evidence_gap_requests.sql
```

Tables:

```text
rag.evidence_gap_requests
integration.evidence_gap_idempotency
integration.evidence_gap_rate_limits
audit.evidence_gap_authentication_failures
```

Las tres tablas tenant-owned usan FORCE RLS. El aggregate es inmutable; el rol
de aplicación recibe `SELECT/INSERT`, nunca `UPDATE/DELETE`. Response body y
SHA-256 deben coincidir mediante constraint PostgreSQL.

## Audit y privacidad

Tenant audit registra IDs acotados, outcome, reason code y digest de key. No
registra Bearer, raw key, subject, missing-document text, reason o campaign
reference. Los authentication failures pre-tenant se agregan por minuto/reason.

El aggregate sí conserva los campos documentales porque constituyen el intake de
producto. Retention/deletion y legal hold requieren decisión humana antes de
producción.

## Verificación local

```text
npm run eval:evidence-gap                 14/14
npm run contracts:validate               17/17
PostgreSQL non-owner SQL gate             pass
npm run smoke:evidence-gap                pass
```

El smoke compilado observó:

```text
401, 200, 200, 200, 200, 200, 409, 409, 403, 400, 400, 500, 200
```

Esto prueba el slice local y disposable. No prueba consumer OS Electoral,
retention aprobada, staging, load, HA, observability ni deployment.
