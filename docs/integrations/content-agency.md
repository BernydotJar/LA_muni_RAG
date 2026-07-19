# Integración con AI-Native Content Agency SaaS

Estado: contrato de boundary definido; ClaimPack/API/contract tests no implementados  
Fecha de corte: 2026-07-18  
Producto vecino: [`BernydotJar/AI-Native-Content-Agency-SaaS`](https://github.com/BernydotJar/AI-Native-Content-Agency-SaaS)

## Propósito

Content Agency puede usar afirmaciones documentales verificadas para producir contenido dentro de un brief aprobado. LA Muni RAG entrega claims, citas y límites de paráfrasis; no decide la estrategia de comunicación, no redacta las piezas y no publica.

## Cadena de ownership

```text
OS Electoral
  -> ApprovedCommunicationBrief (objetivo/mensaje/audiencia aprobados)

LA Muni RAG
  -> ClaimPack (claims + evidencia + restricciones)

Content Agency
  -> ContentPackage (artefactos + risk/Greenlight/publication/performance)
```

LA Muni RAG participa únicamente en el `ClaimPack` y en la resolución de sus evidence refs. `ApprovedCommunicationBrief` es propiedad de OS Electoral y `ContentPackage` es propiedad de Content Agency. Los tres artefactos no forman un agregado compartido.

## LA Muni RAG -> Content Agency: `ClaimPack`

Campos de dominio mínimos:

```text
claim_pack_id
claims[]
citation_refs[]
allowed_paraphrase_scope
legal_disclaimer
jurisdiction
valid_until
source_links[]
```

El envelope/contrato final también debe fijar `schema_version`, `tenant_id`, producer, `generated_at`, correlation/request refs, versiones de inputs, contradictions, missing evidence y limitations cuando correspondan. Esos campos se normalizan en [Contratos entre productos](./contracts.md).

### Semántica obligatoria

- `claims[]` contiene unidades identificables; cada claim enlaza una o más `citation_refs[]` o expresa que no puede autorizarse.
- `citation_refs[]` resuelve a una versión/sección inmutable de LA Muni RAG; el consumidor no sustituye la cita por una URL sin versión.
- `allowed_paraphrase_scope` es una restricción de uso, no una instrucción de copy.
- `legal_disclaimer` viaja sin eliminación; Content Agency puede presentarlo según canal pero no alterar su significado.
- `jurisdiction` acompaña cada uso; una afirmación comparativa de Mixco no se presenta como oficial para Antigua.
- `valid_until` limita reutilización automática. No garantiza por sí solo que la fuente siga vigente; supersession/revocation conocida prevalece.
- `source_links[]` son referencias de acceso, no sustituyen IDs, hashes o citations.

## Content Agency como consumidor

Content Agency debe:

1. conservar `claim_pack_id`, versión/schema y evidence refs en cada artefacto derivado;
2. rechazar o llevar a revisión claims fuera de jurisdiction, validity o paraphrase scope;
3. mantener visible disclaimer, contradictions y limitations;
4. registrar qué versión del pack usó el Greenlight manifest;
5. solicitar un nuevo pack cuando expire o sea superseded;
6. tratar la aprobación de contenido y la autoridad jurídica como decisiones distintas.

Content Agency no puede:

- editar el ClaimPack y conservar el mismo ID;
- añadir un claim jurídico sin cita y atribuirlo a LA Muni RAG;
- consultar las tablas/corpus internos;
- declarar oficial una fuente comparativa;
- interpretar Greenlight como aprobación de procedimiento;
- pedir a LA Muni RAG que genere copy, media, calendar, publication o performance analysis.

## Interacciones que no pertenecen a LA Muni RAG

### OS Electoral -> Content Agency: `ApprovedCommunicationBrief`

```text
brief_id
campaign_id
objective
approved_audience
approved_message
approved_claims[]
prohibited_claims[]
channels[]
budget_constraints
timing
approvals[]
evidence_bundle_refs[]
```

LA Muni RAG puede reconocer `evidence_bundle_refs[]` que haya emitido, pero no crea ni modifica audiencia, mensaje, canal, presupuesto o aprobación del brief.

### Content Agency -> OS Electoral: `ContentPackage`

```text
content_package_id
brief_id
artifacts[]
risk_report
greenlight_status
evidence_refs[]
publication_status
performance_summary
```

LA Muni RAG no recibe este paquete como system of record. Si se usa para audit cruzado, conserva sólo la referencia necesaria y nunca promociona performance o Greenlight a evidence status.

## Transporte, seguridad e idempotencia

- ClaimPack se entrega únicamente por API versionada o artefacto sandbox validado por el mismo JSON Schema.
- Content Agency usa integration identity; headers de tenant/principal de desarrollo no son autenticación de producción.
- LA Muni RAG autoriza tenant y alcance del corpus antes de producir/resolver claims.
- Requests mutables usan `Idempotency-Key`; reuso compatible retorna el receipt original y reuso conflictivo falla.
- `correlation_id` y audit conectan pack, consultas y decisiones sin registrar briefs/prompts completos en logs.
- No hay DB/shared filesystem cross-product, sync bidireccional genérica ni transacción distribuida.

## Cambios, expiry y contradicciones

- Un cambio material de claims/citations crea un nuevo `claim_pack_id` o revisión inmutable definida por schema; no sobrescribe el pack consumido.
- Un breaking change de forma/semántica crea un nuevo major API/schema.
- Si aparece una contradicción, revocation o fuente superseding, LA Muni RAG emite un nuevo snapshot/estado explícito; Content Agency decide sobre sus propios artefactos.
- Si no puede probarse la vigencia, el pack conserva limitation o no autoriza el claim.
- El consumidor no “arregla” localmente un pack expirado.

## Boundary examples

| Solicitud | Respuesta permitida de LA Muni RAG |
|---|---|
| “Dame claims citables sobre el procedimiento X.” | `ClaimPack` con jurisdiction, citations, allowed scope y limitations. |
| “Escribe diez posts y prográmalos.” | Refusal de ownership; identifica Content Agency como owner. |
| “Cambia el mensaje aprobado para que convierta más.” | Refusal de ownership; esa decisión corresponde a OS Electoral/Content Agency. |
| “Omite el disclaimer para que quepa.” | Rechazo o pack sin autorización de uso; el disclaimer no se elimina. |

## Estado real al corte

- LA Muni RAG no implementa `ClaimPack`, schema/OpenAPI, endpoint, integration identity, adapter ni contract tests.
- Content Agency, en la rama inspeccionada `feat/production-foundation-v1` y commit `20a6e31ccaa54f10327858bee33996c52242f4e3`, tiene API HTTP v1 local para missions/runs/approvals, persistence SQL e idempotency.
- Esa identidad usa headers sólo en desarrollo; proveedores/publicación son sandbox y staging/producción no están implementados.
- Su OpenAPI observado no contiene ClaimPack ni un cliente de LA Muni RAG. Además, la evidencia proviene de una feature branch, por lo que no se asume integrada a su `main`.
- En consecuencia, este documento define una integración futura y no una ruta operativa.

## Gates de implementación

1. JSON Schema/OpenAPI de ClaimPack y su request están aprobados y versionados.
2. Identity/tenant mapping y autorización negativa están probados.
3. Citation resolution, expiry, supersession y prohibited-claim cases tienen contract tests.
4. Content Agency conserva IDs/evidence refs en el output de prueba.
5. EVAL-CONTENT-INTEGRATION-001 y EVAL-BOUNDARY-001 pasan.
6. Ningún test ejecuta publicación, gasto o proveedor externo real.

## Documentos relacionados

- [Catálogo y reglas de contratos](./contracts.md)
- [Integración con OS Electoral](./os-electoral.md)
- [Límites del producto](../product/product-boundaries.md)
- [ADR-0001](../adr/0001-product-boundaries-and-data-ownership.md)
