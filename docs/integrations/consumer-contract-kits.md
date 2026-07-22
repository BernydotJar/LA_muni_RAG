# Kits portables de contratos de consumidor v1

Estado: verificación provider-side implementada; consumidores externos pendientes.

## Propósito

Los manifiestos de `contracts/consumer-kits/v1` permiten que OS Electoral y
Content Agency verifiquen la frontera publicada por LA Muni RAG sin importar
código TypeScript del provider, consultar su base de datos ni compartir
filesystem interno.

```text
contracts/consumer-kits/v1/
  consumer-contract-kit.schema.json
  os-electoral.json
  content-agency.json
```

Cada interacción declara método, ruta, headers obligatorios de request/response, estados de éxito y
error, schema/ejemplo de request, schema/ejemplo de response, error canónico,
campos prohibidos y reglas de preservación.

## Ejecución

Desde un checkout del provider:

```bash
npm run contracts:consumer-verify
```

El comando compara los manifiestos contra el OpenAPI 3.1.1 y vuelve a validar
los ejemplos con los JSON Schemas draft 2020-12 canónicos. Falla ante drift de
ruta, método, header, status, schema, ejemplo, identidad del consumidor o campo
que pertenezca al producto vecino.

Un consumidor puede fijar por commit SHA y copiar los JSON Schemas, ejemplos y
manifiestos. El CLI de este repositorio es provider-side; cada repositorio vecino
debe ejecutar una verificación equivalente en su propio pipeline. La integración
no debe descargar `main` mutable.

## Cobertura

### OS Electoral

- `POST /api/v1/procedure-queries` -> `EvidenceBundle`
- `POST /api/v1/procedure-queries` -> `ProcedureWorkflow`
- `POST /api/v1/procedure-queries` -> `ProcedureAssessment`
- `POST /api/v1/evidence-gap-requests` -> `EvidenceGapResponse`

### Content Agency

- `POST /api/v1/claim-packs` -> `ClaimPack`

## Límites

Esta validación no prueba interoperabilidad entre repositorios. No modifica OS
Electoral ni Content Agency, no usa credenciales externas y no ejecuta tráfico de
producción. Tampoco prueba preservación real de IDs/citas en los stores vecinos,
reintentos de red, revocación/supersession cross-product ni despliegue.

Las pruebas E2E son la última capa: deben ejecutarse después de estabilizar
contratos, identidad, datos de prueba, infraestructura efímera y journeys de
usuario. El orden evita usar el navegador para descubrir defectos que pertenecen
a schemas, autorización, persistencia o contratos.
