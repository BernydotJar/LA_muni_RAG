# Domain Pack Bootstrap CLI

Feature `048-template-bootstrap-cli` creates an inactive, reviewable domain-pack scaffold under `domain-packs/<id>/`.

## Dry run

```bash
npm run domain:init -- \
  --id legal \
  --name "Legal Procedure Assistant" \
  --language es \
  --dry-run
```

Dry-run validates and renders the complete plan in memory. It does not create `domain-packs/` or write files.

## Create a scaffold

```bash
npm run domain:init -- \
  --id legal \
  --name "Legal Procedure Assistant" \
  --language es
```

The command creates exactly:

```text
domain-packs/legal/
├── README.md
├── domain-pack.json
├── starter.test.ts
└── workflow-templates.json
```

The generated pack is not added to `src/domain/registry.ts`, is not published, and cannot become active automatically.

## Safety contract

- IDs must be lowercase kebab-case and at most 63 characters.
- Built-in and operational IDs are reserved.
- The destination is fixed to `domain-packs/<id>/`; no custom output path is accepted.
- Existing targets fail closed.
- Files are created exclusively and never overwritten.
- All generated content is marked `draft` and `placeholder`.
- The manifest is `authoritative: false`.
- Workflow templates start empty.
- No laws, policies, deadlines, approvals, organizations, or responsible roles are generated.

## Authoring sequence

1. Review `README.md` and `domain-pack.json`.
2. Replace every placeholder with verified domain-owner content.
3. Define authority classes and governance rules before procedures.
4. Add evidence-backed workflows through the validated workflow-template contract.
5. Replace the starter query and evaluation case with verified clean-room cases.
6. Run tests and domain evaluations.
7. Integrate the pack into the runtime registry only through a separate reviewed feature.

A generated scaffold is a drafting aid, not organizational policy or operational guidance.
