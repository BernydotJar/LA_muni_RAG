# Workflow Lifecycle API v1

Estado: implementado y verificado localmente con PostgreSQL; CI remoto y deployment pendientes.

Fecha de corte: 2026-07-21

## Endpoints

```http
POST /api/v1/workflow-drafts
POST /api/v1/workflow-reviews
POST /api/v1/workflow-approvals
GET  /api/v1/workflows/{workflow_version_id}
```

Estas rutas gobiernan versiones de procedimientos propiedad de LA Muni RAG. No
publican campañas, contenido, tareas editoriales ni operaciones electorales.

## Autenticación, tenant y roles

Todas las rutas requieren:

- `Authorization: Bearer ...` validado por digest SHA-256;
- `X-Request-Id` UUID;
- tenant y credential provenance iguales a la identidad autenticada;
- transacción con `app.tenant_id` local;
- rate limit por tenant, principal y operación;
- auditoría allowlisted sin request bodies ni secretos.

Permisos por acción:

| Acción | Permiso |
|---|---|
| crear draft | `procedure:draft` |
| enviar a review | `procedure:draft` |
| registrar review | `procedure:review` |
| aprobar, superseder o archivar | `procedure:approve` |
| leer versión | `procedure:read` |

La autenticación y el control grueso de permiso ocurren antes de leer bytes del
body. Rechazos tempranos cierran la conexión cuando existe un body no consumido.

## Lifecycle

```text
draft -> in_review -> approved -> superseded -> archived
  ^         |
  |---------| changes_requested
```

Reglas principales:

1. toda versión nueva comienza `draft`, incluso si su origen es AI, human o import;
2. el creator puede enviar el draft a review;
3. un reviewer distinto puede solicitar cambios o recomendar aprobación;
4. un approver distinto del creator y reviewer puede aprobar;
5. contenido aprobado, superseded o archived es inmutable;
6. corregir contenido aprobado requiere una versión nueva;
7. sólo puede existir una versión aprobada por tenant/procedure;
8. supersession debe apuntar a otra versión del mismo procedimiento;
9. `archived` es terminal;
10. approval status no demuestra vigencia jurídica, suficiencia documental ni ejecución institucional.

## Contratos

Los requests y la respuesta validan con JSON Schema 2020-12 estricto:

- `workflow-draft-request.schema.json`;
- `workflow-review-request.schema.json`;
- `workflow-approval-request.schema.json`;
- `workflow-version.schema.json`.

La definición embebida valida además contra `procedure-workflow.schema.json`. Un
caller no puede cambiar `approval_status` a `approved` dentro del draft ni usar un
tenant diferente en la definición anidada.

## Idempotencia

Las tres mutaciones requieren `Idempotency-Key` de 16 a 128 caracteres
allowlisted. La base conserva únicamente:

- hash SHA-256 de la key;
- hash SHA-256 del request canónico;
- estado `processing` o `completed`;
- respuesta validada y acotada;
- audit ID y timestamps.

Resultados:

- replay exacto: mismo status y mismos bytes;
- payload distinto con la misma key: `409 idempotency_conflict`;
- ejecución concurrente activa: `409 request_in_progress`;
- replay almacenado inválido: se invalida en una transacción confirmada, se
  responde `500 internal_error` sin filtrar bytes y el siguiente intento puede
  regenerar la operación.

## Respuestas y no enumeración

- `201`: draft creado;
- `200`: transición o lectura exitosa;
- `400`: headers, JSON, schema o identidad de request inválidos;
- `401`: autenticación ausente/rechazada, con tenant y credential nulos;
- `403`: permiso, tenant o credential provenance rechazados;
- `404`: workflow inexistente o de otro tenant, con la misma forma no enumerante;
- `409`: conflicto de idempotencia o transición/lifecycle inválidos;
- `429`: límite excedido;
- `500`: dependencia, respuesta o replay inválidos.

## Persistencia

- `rag.procedures`;
- `rag.procedure_versions`;
- `rag.workflow_reviews`;
- `rag.workflow_approvals`;
- `integration.workflow_lifecycle_idempotency`;
- `integration.workflow_lifecycle_rate_limits`;
- `audit.events` para eventos tenant-scoped;
- `audit.workflow_lifecycle_authentication_failures` para agregados pre-tenant.

Las tablas tenant-scoped usan forced RLS y referencias tenant-composite. Reviews
y approvals son append-only. La función pre-tenant usa `SECURITY DEFINER`,
audit storage revocado y search path fijo.

## Verificación

```bash
npm run typecheck
npm run test:workflow-lifecycle
npm run contracts:validate
npm run build
DATABASE_URL=postgresql://... npm run smoke:workflow-lifecycle
```

El gate SQL exacto es `db/tests/workflow_lifecycle_runtime_gate.sql` y sólo se
ejecuta contra `la_muni_rag_test`. Debe usar un rol runtime no-owner,
`NOSUPERUSER` y `NOBYPASSRLS`. El 21 de julio de 2026 pasó localmente en
PostgreSQL 15.18 con pgvector 0.8.5; el smoke HTTP compilado confirmó exact replay,
separación humana, supersession atómica, 404 no enumerante e invalidación segura
de replay corrupto. CI conserva PostgreSQL 16 y pgvector 0.8.5 como gate remoto.

## Límites no acreditados

- UI autenticada de review/approval y accessibility;
- consumer externo OS Electoral;
- resolución semántica de conflictos o selección de versión jurídicamente aplicable;
- backup/restore, load, HA, staging, observability y deployment;
- aprobación humana para merge protegido o producción.
