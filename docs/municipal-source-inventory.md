# Municipal Source Inventory Runbook

## Purpose

The source inventory records what is known about a documentary source before it becomes part of the searchable corpus. It is separate from the operational corpus manifest.

- `.rag/source-inventory.json` records discovery, authority, jurisdiction, acquisition, extraction, and ingestion claims.
- `.rag/corpus-manifest.json` records operational indexing outcomes.

A source inventory record is not proof that a document was downloaded, extracted, indexed, or legally applicable.

## States

- `missing_source`: expected source not located; no URL or processing evidence.
- `identified`: source is known by name but not verified.
- `verified`: an official URL and verification timestamp exist.
- `acquisition_pending`: source is verified or identified and awaiting controlled acquisition.
- `acquired`: artifact path and SHA-256 exist.
- `ingestion_pending`: acquired artifact awaits extraction or indexing.
- `ingested`: acquisition, extraction, indexing, and matching operational manifest evidence exist.
- `failed`: a stable failure code exists.
- `superseded`: a replacement source record is explicit.

## Authority rules

For La Antigua Guatemala:

1. Antigua municipal source applicable to the procedure.
2. Current national law or regulation.
3. Official case file.
4. Official comparative source from another municipality.
5. Contextual source.
6. Inference.
7. Not found.

National law is applicable authority but does not prove Antigua's internal implementation.

Any source that names another municipality must remain comparative for Antigua. For Mixco, every record must use:

- `municipality = mixco`
- `authorityClass = external_reference`
- `authorityLevel = comparative`
- `officialSource = true`
- `officialForTargetJurisdiction = false`
- limitation: `Referencia comparativa de la Municipalidad de Mixco; no define por sí sola el procedimiento oficial de Antigua Guatemala.`

## Validation

Run:

```bash
npm run source-inventory:validate
```

The command must report zero acquired and zero ingested records until concrete artifact evidence exists.

## Acquisition procedure

Before changing a record to `acquired`:

1. confirm authorization and public/internal classification;
2. download or receive the original artifact;
3. preserve the raw artifact without transformation;
4. compute SHA-256 over the acquired bytes;
5. record artifact path, acquisition timestamp, media type, and byte length;
6. preserve the official source URL and verification date;
7. do not overwrite a prior acquired version with a different hash.

Before changing a record to `ingested`:

1. extraction completed successfully;
2. section count is positive;
3. index result is successful;
4. indexed chunk count is positive;
5. operational corpus manifest has the same document key, version, and hash;
6. reconciliation passes.

## Current limitations

The inventory intentionally contains no acquired or ingested documents. The Mixco
library landing page, Congress decree index, Antigua PDM-OT PDF identity, and Antigua
procedure-manual catalog are verified official discovery surfaces. The individual
Antigua DMP v3 manual is queued as `acquisition_pending`, but its bytes, SHA-256,
internal approval, effective date, and validity have not been inspected. Other
priority Antigua documents without confirmed official URLs remain `missing_source`.

See [Antigua procedure-manual source verification](./data/antigua-procedure-manuals-source.md)
for the catalog evidence and exact promotion gate.
