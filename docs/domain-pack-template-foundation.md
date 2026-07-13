# Domain Pack Template Foundation

Feature: `042-domain-pack-template-foundation`  
Status: MVP

## Purpose

The domain-pack foundation separates reusable procedural assistant behavior from Antigua-specific municipal governance. The repository now loads a validated `DomainPack` and uses it to classify procedural questions, identify source authority, compose workflow steps, expose governance warnings, and preserve domain identity in feedback metadata.

The default remains Antigua-first:

```env
DOMAIN_PACK=municipal-antigua
```

Unsupported `DOMAIN_PACK` values fail closed.

## Starter Packs

The registry currently includes:

- `municipal-antigua`: official Antigua-first municipal workflows, with other municipalities treated only as comparative external references.
- `hr`: employee onboarding, leave, offboarding, disciplinary, and compensation workflow templates.
- `finance`: invoice, expense, month-end, audit, and budget-transfer workflow templates.
- `sales-sop`: lead qualification, discount approval, handoff, proposal, and contract workflow templates.
- `custom`: minimal starter pack for a new evidence-first procedural assistant.

## Pack Contract

Each pack defines:

- identity and branding;
- language and locale;
- workflow types;
- source authority classes;
- classifier rules and retrieval hints;
- workflow templates;
- governance rules;
- feedback types;
- starter evaluation cases.

The core types live in:

```text
src/domain/types.ts
```

The registry and startup validation live in:

```text
src/domain/registry.ts
```

Starter packs live in:

```text
src/domain/packs/
```

## Antigua Governance Rule

For `municipal-antigua`, official Antigua documents and applicable national law remain the preferred authorities. Materials from Mixco, Villa Nueva, Municipalidad de Guatemala, or other municipalities are classified as `external_reference`.

The assistant may use those documents only with comparative language:

```text
Encontré referencia procedimental de otra municipalidad; debe validarse contra documentos oficiales de Antigua Guatemala y normativa nacional aplicable.
```

It must not present external municipal procedures as official Antigua procedure.

## Procedure Metadata

Procedure workflows now include domain metadata:

```json
{
  "domainPackId": "municipal-antigua",
  "domainPackName": "Municipal Antigua",
  "hasLocalEvidence": true,
  "hasExternalReference": false
}
```

`hasAntiguaEvidence` is retained for backward compatibility. New domain-aware behavior should prefer `hasLocalEvidence`.

## Feedback Metadata

Procedure feedback now validates and stores `domainPackId` inside the existing JSON metadata column. No database migration is required for this feature.

Feedback remains product signal. It is not evidence and must not be promoted into the corpus without a separate review/ingestion workflow.

## Adding A New Pack

1. Add a file in `src/domain/packs/`.
2. Define a `DomainPack` with unique workflow type ids, authority ids, classifier rules, templates, governance rules, and feedback types.
3. Export it from `src/domain/packs/index.ts`.
4. Add it to `DOMAIN_PACKS` in `src/domain/registry.ts`.
5. Add tests that prove the pack loads, fails closed on invalid configuration, and generates neutral workflows without leaking Antigua terminology.
6. Document the pack's evidence hierarchy and validation warnings.

## Known Limits

- Existing public pages still carry municipal-first visual language.
- Ingestion/admin flows are not yet fully pack-scoped.
- Starter HR, finance, sales SOP, and custom packs provide reusable templates, not authoritative deployed policy corpora.
