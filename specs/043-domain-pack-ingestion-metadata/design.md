# Design — Domain Pack Ingestion Metadata

## Scope

This feature extends the existing corpus backfill path. The current path already accepts arbitrary `metadata` on `CorpusBackfillDocumentInput` and passes it to `indexVectorSource`. The missing layer is validated, domain-aware metadata at the CLI and manifest level.

## Metadata Shape

Backfill builds metadata compatible with `DomainDocumentMetadata`:

```ts
{
  domainPackId: "municipal-antigua",
  sourceAuthorityClass: "municipal_manual",
  documentType: "manual",
  jurisdiction: "Antigua Guatemala",
  organization: "Municipalidad de La Antigua Guatemala",
  confidentiality: "public",
  tags: ["contratacion", "obra"]
}
```

Required after normalization:

- `domainPackId`

Optional:

- `sourceAuthorityClass`
- `documentType`
- `jurisdiction`
- `organization`
- `confidentiality`
- `tags`

## Validation

The CLI resolves the domain pack through `loadDomainPack`. Invalid pack ids throw `DomainPackConfigError` before file reads, indexer calls, or manifest writes.

If `sourceAuthorityClass` is provided, it must match one authority id in the selected pack.

If `confidentiality` is provided, it must be `public`, `internal`, or `restricted`.

## Manifest

`CorpusManifestRecord` receives optional `documentMetadata`. Reindex decisions compare this metadata with the incoming document metadata so metadata-only corrections are not skipped.

Existing manifest files remain compatible because the new field is optional.

## CLI Flags

New flags:

- `--domain-pack`
- `--source-authority-class`
- `--document-type`
- `--jurisdiction`
- `--organization`
- `--confidentiality`
- `--tag` repeatable

## Safety

The feature does not add secrets, auth, network calls, destructive file operations, or database migrations.
