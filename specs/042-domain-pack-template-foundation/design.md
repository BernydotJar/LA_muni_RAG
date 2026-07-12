# Design — Domain Pack Template Foundation

## Architecture

```text
RAG Core
  ├── retrieval
  ├── evidence
  ├── ingestion
  ├── procedure/workflow runtime
  ├── feedback
  ├── API
  └── security/governance

Domain Packs
  ├── municipal-antigua
  ├── hr
  ├── finance
  ├── sales-sop
  └── custom
```

## New Modules

```text
src/domain/types.ts
src/domain/validation.ts
src/domain/registry.ts
src/domain/packs/*.ts
```

## Domain Pack Contract

The MVP pack defines:

- identity and language;
- branding labels;
- workflow types;
- source authority classes;
- classifier rules and retrieval hints;
- workflow templates;
- governance warnings;
- feedback labels;
- example queries;
- evaluation placeholders.

## Runtime Binding

The active pack is resolved from:

```text
DOMAIN_PACK
```

Default:

```text
municipal-antigua
```

Invalid explicit values throw a stable `invalid_domain_pack` configuration error.

## Procedure Runtime

The procedure runtime receives the active pack through dependency injection from the server.

Feature 042 keeps the current municipal behavior intact while adding:

- pack-driven classifier rules;
- pack-driven retrieval hints;
- pack-driven source authority rules;
- pack-driven templates for non-municipal packs;
- domain metadata in the `ProcedureWorkflow` response.

## API

`GET /health` exposes:

```json
{
  "domainPack": {
    "id": "municipal-antigua",
    "name": "...",
    "language": "es",
    "branding": { "...": "..." }
  }
}
```

`GET /api/procedure` includes domain-pack metadata in `workflow.metadata`.

## Future Document Administration

Feature 042 defines:

```ts
type DomainDocumentMetadata = {
  domainPackId: string;
  sourceAuthorityClass: string;
  documentType: string;
  jurisdiction?: string;
  organization?: string;
  confidentiality?: "public" | "internal" | "restricted";
  effectiveDate?: string;
  expirationDate?: string;
  tags?: string[];
};
```

No upload or admin UI is implemented in this feature.

## Test Strategy

Static and unit tests verify:

- all required packs load and validate;
- invalid configured domain pack fails closed;
- default active pack is `municipal-antigua`;
- health exposes safe domain identity;
- procedure workflows include `domainPackId`;
- municipal Antigua external-reference behavior remains intact;
- HR/finance/sales packs produce neutral, non-Antigua workflow templates.
