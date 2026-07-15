# Design — Template Bootstrap CLI

## Overview

Feature 048 adds a small authoring boundary around draft domain-pack scaffolding. The CLI writes only deterministic JSON, Markdown, and TypeScript starter-test files under `domain-packs/<safe-id>/`. Generated content is intentionally inactive and non-authoritative.

## Components

### `src/domain/bootstrap.ts`

Pure and filesystem-aware bootstrap utilities:

- `parseDomainInitArgs(args)` parses the supported CLI flags.
- `validateDomainBootstrapOptions(options)` normalizes and validates id, name, and language.
- `renderDomainPackScaffold(options)` returns a deterministic sorted list of files and contents without writing.
- `validateDomainPackScaffold(manifest, templates)` validates the draft contract.
- `buildStarterEvaluationPack(scaffold)` creates an in-memory `DomainPack` solely for the starter evaluation; it does not register or persist a runtime pack.
- `initializeDomainPack(options, dependencies?)` performs dry-run or exclusive creation under a fixed root.

The optional dependency/root injection exists for isolated automated tests. The public CLI does not expose an arbitrary root flag.

### `src/cli/initDomainPack.ts`

Thin process boundary:

1. parse arguments;
2. call the bootstrap library with `process.cwd()`;
3. print stable JSON containing status, target, count, and relative file paths;
4. exit non-zero with a stable, redacted error message on failure.

### Generated scaffold

```text
domain-packs/<id>/
├── domain-pack.json
├── workflow-templates.json
├── README.md
└── starter.test.ts
```

`domain-pack.json` contains draft placeholders for branding, workflow types, authority classes, classifier rules, governance rules, queries, and evaluation cases. `workflow-templates.json` uses the editable workflow collection envelope introduced in Feature 047 and starts with `templates: []`.

## Draft Manifest Contract

The generated manifest contains:

- `schemaVersion: 1`;
- `status: "draft"`;
- `authoritative: false`;
- safe id, display name, and language;
- draft branding;
- one neutral placeholder workflow type;
- one unknown/draft source-authority class;
- one placeholder classifier rule;
- zero persisted workflow templates;
- one evidence-first draft governance warning;
- zero feedback types;
- draft example queries;
- one starter evaluation case.

The placeholder evaluation can classify a neutral `draft_workflow` query. For evaluation only, an in-memory placeholder workflow template is added so the existing `validateDomainPack` and `evaluateDomainPack` paths can be reused. That template is never written to the scaffold.

## Path and Write Safety

- IDs must match `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` and be at most 63 characters.
- The target is always derived as `<workspace>/domain-packs/<id>`.
- Existing built-in pack ids and operational ids are reserved.
- The CLI has no `--output`, `--path`, or equivalent flag.
- The target is checked before creation.
- The target directory is created with non-recursive exclusive semantics after ensuring the fixed parent exists.
- Files are written with exclusive creation flags.
- On a write failure, cleanup is limited to the new target directory created by that invocation.
- Dry-run renders and validates in memory, then performs no filesystem writes.

## Determinism

- File order is lexicographically stable.
- JSON uses two-space indentation and a trailing newline.
- Placeholder ids and text are constant functions of normalized options.
- README and starter-test contents are generated from fixed templates.
- CLI output uses repository-relative paths only.

## Error Model

`DomainBootstrapError` exposes stable codes:

- `invalid_arguments`;
- `invalid_id`;
- `reserved_id`;
- `invalid_name`;
- `invalid_language`;
- `target_exists`;
- `invalid_scaffold`;
- `write_failed`.

Errors never include secrets or arbitrary file contents.

## Tests

`src/__tests__/domain-pack-bootstrap-cli.test.ts` covers:

- argument parsing;
- safe normalization;
- traversal and unsafe-id rejection;
- reserved-id rejection;
- deterministic render output;
- dry-run no-write behavior;
- exclusive creation and existing-target refusal;
- generated draft markers and non-authoritative status;
- empty workflow-template collection;
- scaffold validation;
- in-memory starter evaluation;
- bounded temporary-directory cleanup.

## Verification

```bash
npm run typecheck
npm run build
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
```

After Pages verification, restore tracked `dist-pages/` content and remove only generated untracked files rather than deleting the directory.
