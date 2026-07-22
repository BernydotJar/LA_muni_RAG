# ClaimPack API v1

Estado: provider local implementado; consumer externo y CI PostgreSQL del HEAD pendientes

Fecha de corte: 2026-07-21

## Endpoint

```http
POST /api/v1/claim-packs
Authorization: Bearer <integration credential>
Idempotency-Key: <16-128 allowlisted characters>
X-Request-Id: <UUID equal to body request_id>
Content-Type: application/json
```

La ruta acepta únicamente el contrato cerrado `ClaimPackRequest v1` de Content
Agency. El request contiene una pregunta documental, jurisdicción, contexto
acotado y provenance de la integration identity; no acepta campaign IDs,
community IDs, briefs, canales, copy, assets ni instrucciones de publicación.

## Respuesta 200

La respuesta valida contra `claim-pack.schema.json` e incluye:

- claims con `citation_refs` verificables;
- citas enlazadas a document, version y section;
- `allowed_paraphrase_scope` server-owned;
- disclaimer legal server-owned;
- jurisdicción y `valid_until`;
- enlaces HTTPS de las fuentes citadas;
- limitations y provenance autenticado.

El provider emite un pack sólo cuando existe al menos un claim `supported` o
`comparative_reference`, una cita válida y un source link verificable. Evidencia
`inference` o `validation_required` no se empaqueta como claim utilizable.

`valid_until` es un límite operativo de reutilización de hasta 24 horas. No
prueba la vigencia jurídica de una fuente; supersession, revocation o una
limitación documental conocida prevalecen. Un replay expirado se invalida y
requiere una nueva generación.

## Abstención y errores

- `400 invalid_request`: JSON/headers/schema inválidos.
- `401 unauthorized`: credencial ausente o rechazada; la autenticación ocurre
  antes de leer el body.
- `403 forbidden`: rol, tenant, credential provenance o product boundary
  rechazados con forma uniforme y sin metadata leakage.
- `409 insufficient_evidence`: no hay claims citables suficientes.
- `409 idempotency_conflict` / `request_in_progress`: uso incompatible o
  concurrente de la misma key.
- `409 claim_pack_expired`: el replay anterior expiró y debe regenerarse.
- `429 rate_limit_exceeded`: límite tenant/principal excedido.
- `500 internal_error`: dependencia, mapping o replay almacenado inválidos.

## Idempotencia y persistencia

La key se persiste únicamente como SHA-256, junto con el digest canónico del
request y la respuesta ya validada. No se almacenan Bearer tokens, request
bodies, briefs, copy, prompts ni datos de publicación. Un replay exacto devuelve
los mismos bytes; un request distinto con la misma key falla cerrado.

La migración `008_claim_pack_api.sql` crea tablas separadas para idempotencia y
rate limiting con RLS forzada, además de un sink pre-tenant sanitizado para
fallos de autenticación. El runtime role no es owner, superuser ni BYPASSRLS.

## Product boundary

LA Muni RAG returns claims, citations, paraphrase limits, disclaimer, validity
bound, and source links. It does not generate copy, assets, channels,
publication tasks, or campaign strategy.

Las solicitudes de producción de contenido se rechazan; Content Agency sigue
siendo source of truth para briefs, runs, artifacts, Greenlight y publicación.
Las solicitudes de estrategia electoral se rechazan; OS Electoral sigue siendo
source of truth para decisiones y estrategia de campaña.

## Verificación

```bash
npm run contracts:validate
npm run eval:content-integration
npm run typecheck
npm test
npm run build
```

Evidencia ejecutable:

- `src/__tests__/eval-content-integration-001.test.ts` — provider, replay,
  abstención, RBAC, tenant, Mixco, boundary y no-promotion.
- `src/__tests__/claim-pack-runtime-migration.test.ts` — RLS, storage minimizado
  y auditoría.
- `db/tests/claim_pack_runtime_gate.sql` — rol no propietario y aislamiento A/B.
- `scripts/claim-pack-postgres-smoke.mjs` — smoke HTTP compilado.

El sandbox actual no puede registrar las capas de la imagen pgvector fijada
(`operation not supported`), por lo que el SQL gate y smoke del HEAD quedan
cableados para CI remoto. Ninguna prueba publica contenido ni llama proveedores
externos.
