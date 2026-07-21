# Integración con OS Electoral

Estado: providers `EvidenceBundle` y `ProcedureWorkflow` implementados y probados localmente; `ProcedureAssessment` y consumer OS Electoral pendientes

Fecha de corte: 2026-07-21
Producer/consumer vecino: [`BernydotJar/OS-Electoral`](https://github.com/BernydotJar/OS-Electoral)

## Propósito

OS Electoral necesita evidencia cívica y procedimientos para evaluar factibilidad, estructurar propuestas, registrar riesgos y construir compromisos realistas. LA Muni RAG debe entregar esa inteligencia sin asumir campaña, estrategia, territorio u operación electoral.

El intercambio es una frontera entre dos systems of record independientes. Las reglas generales están en [Límites del producto](../product/product-boundaries.md) y [Ownership de datos](../architecture/data-ownership.md).

## Ownership

| Dato/decisión | Owner | Tratamiento en el otro producto |
|---|---|---|
| Fuentes, versiones, citas, evidencia y autoridad documental | LA Muni RAG | OS conserva refs/snapshots con provenance; no corrige ni promueve la fuente. |
| Procedimientos y workflow versions | LA Muni RAG | OS consume la versión; no crea una “versión oficial” paralela. |
| Campaign, charter, segment, territory, strategy, objective, proposal y commitment | OS Electoral | LA Muni RAG recibe sólo IDs/contexto mínimo para la consulta; no replica el agregado. |
| Electoral decision, gate, approval, operation y risk | OS Electoral | Una evaluación procedimental puede informar la decisión, nunca reemplazarla. |
| Evidence gap request | OS Electoral es owner de la solicitud; LA Muni RAG es owner de su investigación/resultado | El request no convierte el documento sugerido en fuente validada. |

## Flujos permitidos

```text
OS Electoral
  -> ProcedureQueryRequest
  -> EvidenceGapRequest

LA Muni RAG
  -> EvidenceBundle
  -> ProcedureWorkflow
  -> ProcedureAssessment
```

Los payloads deben viajar por API versionada o, en sandbox, como artefactos validados por el mismo JSON Schema. No se permite acceso a DB, filesystem interno o imports de código/storage entre repositories.

## OS Electoral -> LA Muni RAG

### `ProcedureQueryRequest`

Campos de dominio mínimos:

```text
request_id
tenant_id
campaign_id
community_id
question
jurisdiction
case_context
requested_depth
requested_output
```

Semántica:

- `request_id` es estable para el intento lógico y se correlaciona con la respuesta.
- `campaign_id` y `community_id` son foreign IDs opacos; no conceden acceso ni ownership.
- `jurisdiction` es obligatorio para evitar que el texto de la pregunta decida alcance por inferencia.
- `case_context` aporta hechos declarados por el consumidor y debe distinguirse de evidencia recuperada.
- `requested_depth`/`requested_output` sólo aceptan enums cerrados definidos en schema.
- La respuesta puede ser insuficiente o un refusal de boundary; “no encontrado” no se convierte en procedimiento inventado.

### `EvidenceGapRequest`

Campos de dominio mínimos:

```text
gap_request_id
subject
missing_document
reason
priority
campaign_reference
```

La solicitud entra a la cola/proceso propio de investigación de LA Muni RAG cuando éste exista. Debe conservar producer, tenant, correlation y tiempo. Un título o URL enviado por OS Electoral permanece `identified`/pendiente hasta validar autoridad, jurisdicción, versión, bytes y provenance.

## LA Muni RAG -> OS Electoral

### `EvidenceBundle`

```text
evidence_bundle_id
query
tenant_id
jurisdiction
generated_at
sources[]
claims[]
citations[]
contradictions[]
missing_evidence[]
limitations[]
```

Es un snapshot inmutable. El provider v1 lo deriva de la misma compilación interna usada por `ProcedureWorkflow`: sólo pasos con citas identity-bound se convierten en `claims[]`; la falta de respaldo se expresa en `missing_evidence[]`; `contradictions[]` permanece vacío salvo que exista un conflicto explícito. No es una lista libre de recomendaciones y no contiene decisión, estrategia, segmentación, territorio ni movilización electoral.

### `ProcedureWorkflow`

```text
workflow_id
workflow_version
title
jurisdiction
authority_status
approval_status
steps[]
dependencies[]
decision_gates[]
required_documents[]
outputs[]
citations[]
gaps[]
limitations[]
```

OS Electoral sólo puede tratarlo como workflow aprobado si `approval_status` lo demuestra y el provenance identifica la versión/decisión correspondiente. Un draft sigue siendo draft. Una referencia de Mixco conserva el warning comparativo y no eleva `authority_status` para Antigua.

### `ProcedureAssessment`

```text
assessment_id
procedure_id
case_context
completed_requirements[]
missing_requirements[]
blocked_steps[]
unknowns[]
next_documental_action
```

El assessment describe encaje documental contra una versión de procedimiento. No recomienda estrategia electoral, prioridad territorial, mensaje, compromiso o voto de aprobación. El schema v1 incluye `procedure_id`, `workflow_version`, evidencia y el provenance común definido en [Contratos entre productos](./contracts.md). La persistencia de procedure/workflow versions y su lifecycle humano aún no está implementada.

## Reglas operativas

### Identidad y tenant

- OS Electoral usa una integration credential verificable; `tenant_id` del body nunca autentica.
- LA Muni RAG resuelve scopes permitidos y filtra todo acceso por tenant antes de retrieval.
- Foreign campaign/community IDs se validan como opacos y se auditan, pero LA Muni RAG no los autoriza consultando DB de OS Electoral.
- Errores de tenant o authorization no revelan existencia, título, authority o metadata del recurso.

La foundation de identity, diez roles y RLS tenant-scoped protege `POST /api/v1/procedure-queries`. Un gate desechable con rol PostgreSQL no propietario demostró aislamiento A/B y denial HTTP; esto no equivale a provisioning de producción. Las rutas legacy no son tenant-aware y por eso quedan en 404 por defecto cuando `NODE_ENV=production`.

### Idempotencia y correlation

- Requests POST requieren `Idempotency-Key` además de `request_id`/`gap_request_id`.
- Mismo tenant + operación + key + payload canónico devuelve el resultado original durante la ventana documentada.
- Reuso de key con payload u operación distintos falla como conflicto estructurado.
- `correlation_id` conecta request, retrieval/audit y response sin contener datos sensibles.
- No hay transacción distribuida: cada producto confirma su agregado local y registra la referencia externa.

### Versiones y supersession

- Schema/API usa major version explícito (`v1`).
- `workflow_version` identifica el snapshot procedimental y no se sobrescribe.
- OS conserva la versión usada por una decisión electoral, incluso si luego aparece una versión más nueva.
- LA Muni RAG puede informar supersession, pero no reescribe la decisión de campaña.

### Fallos y refusals

LA Muni RAG debe devolver error/refusal tipado cuando:

- authn/authz/tenant scope falla;
- schema o enum es incompatible;
- la solicitud pide estrategia, segmentación, territorio u operación electoral;
- la jurisdicción falta o es ambigua;
- no hay evidencia suficiente;
- una versión pedida no existe o fue superseded y el contrato exige versión vigente;
- un idempotency key se reutiliza de forma conflictiva.

Un fallo de red se reintenta con la misma key. OS Electoral no debe fabricar una respuesta local ni degradar una recomendación estratégica a “fuente legal”.

## No-superposición en ejemplos

| Solicitud | Respuesta de LA Muni RAG |
|---|---|
| “¿Qué requisitos documentales tiene este proyecto?” | Puede devolver un `EvidenceBundle` con claims/citations/gaps o un `ProcedureWorkflow` draft; `ProcedureAssessment` responde `503 capability_unavailable`. |
| “¿Debemos prometer este proyecto en campaña?” | Devuelve sólo factibilidad/evidencia relevante y declara que la decisión pertenece a OS Electoral. |
| “Prioriza comunidades para movilización.” | Refusal de boundary; no produce territorio o segmento. |
| “Encontramos este manual, decláralo oficial.” | Registra/acepta gap para validación; no promueve la fuente por solicitud del consumidor. |

## Estado real al corte

- LA Muni RAG tiene doce schemas draft 2020-12, doce ejemplos y OpenAPI 3.1.1 con estado `claim_pack_evidence_bundle_procedure_workflow_and_ingestion_job_providers_implemented_with_limits`; ClaimPack usa un request dedicado de Content Agency y los contratos de ingestion siguen siendo operacionales internos, sin ampliar el payload compartido con OS Electoral.
- `POST /api/v1/procedure-queries` autentica por digest, exige `integration:query`, verifica tenant/credential, valida schema, limita tráfico, conserva idempotencia y audit, recupera sólo corpus público/activo/procesado y devuelve un `EvidenceBundle` o `ProcedureWorkflow` nuevamente validado según `requested_output`.
- `EvidenceBundle` conserva document/version/section IDs, source authority, claims con citation refs, gaps, limitaciones y replay exacto; no incluye campaign decision fields. Sin evidencia devuelve claims vacíos y brechas explícitas.
- Pruebas focales cubren ambos outputs, exact-origin CORS, replay exacto, conflicto, tenant mismatch, boundary, 401, replay corrupto y reintento; el gate PostgreSQL/HTTP restaurado requiere CI remoto para el HEAD actual y no existe consumer probado dentro del repositorio OS Electoral.
- La respuesta workflow fija `workflow_version=1.0.0` y `approval_status=draft`, pero carece de lifecycle, version store y aprobación persistente. `ProcedureAssessment` sigue no disponible.
- OS Electoral documenta bounded contexts de campaign/governance y contratos internos read-only; no se observó cliente de LA Muni RAG.
- Por tanto, este documento no autoriza tráfico de producción ni afirma interoperabilidad.

## Gates de implementación

La integración sólo cambia a operativa cuando:

1. los schemas y OpenAPI v1 están versionados;
2. identity/tenant mapping está aplicado también en el consumer;
3. los contract tests del consumer y la prueba entre repositorios cubren éxito, refusal, replay, conflicto y cross-tenant;
4. EVAL-OS-INTEGRATION-001 y EVAL-BOUNDARY-001 pasan;
5. audit demuestra IDs/versiones/provenance sin filtrar cuerpos sensibles;
6. el owner humano aprueba el despliegue.

## Documentos relacionados

- [Catálogo y reglas de contratos](./contracts.md)
- [Integración con Content Agency](./content-agency.md)
- [Contexto del sistema](../architecture/system-context.md)
- [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md)
