# Feature 042 — Domain Pack Template Foundation

## Mode

MVP

## Objective

Begin extracting LA Muni RAG from an Antigua-only procedural assistant into a reusable evidence-first workflow assistant template with validated domain-pack configuration.

The existing `municipal-antigua` behavior remains the default and must continue working without regression.

## Requirements

1. Add a typed `DomainPack` contract.
2. Add validated domain-pack registry and loader.
3. Default `DOMAIN_PACK` to `municipal-antigua`.
4. Explicit invalid `DOMAIN_PACK` values must fail closed with a stable error.
5. Provide initial packs:
   - `municipal-antigua`;
   - `hr`;
   - `finance`;
   - `sales-sop`;
   - `custom`.
6. Preserve Antigua-first governance:
   - official Antigua and national law before external municipal references;
   - external municipal references are comparative only;
   - external references require validation against Antigua documents and applicable national legislation.
7. Procedure classification, source authority classification, retrieval hints, workflow templates, governance warnings, feedback labels, examples, and evaluation placeholders must be represented in domain-pack configuration.
8. `/health` must expose the active domain pack without secrets.
9. `/api/procedure` responses must include active domain-pack metadata.
10. The procedure runtime must support non-municipal packs with neutral workflow templates without falsely showing Antigua-specific authority copy.
11. Add `DomainDocumentMetadata` for future document administration and ingestion.
12. Do not modify generated `dist-pages/`.
13. Do not weaken feedback authentication, source-link validation, external-reference handling, or evidence-first safety.

## Non-goals

- No full document library/admin UI.
- No unrestricted upload.
- No visual workflow template editor.
- No destructive migration.
- No public domain selector that exposes secrets.
