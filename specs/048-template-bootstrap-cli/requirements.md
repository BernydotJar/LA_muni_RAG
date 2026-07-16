# Feature 048 — Template Bootstrap CLI

## Mode

MVP

## Objective

Add a safe, deterministic CLI that scaffolds a reviewable draft domain pack without registering, publishing, or treating the generated content as authoritative.

## Command

```bash
npm run domain:init -- \
  --id legal \
  --name "Legal Procedure Assistant" \
  --language es
```

Optional dry run:

```bash
npm run domain:init -- --id legal --name "Legal Procedure Assistant" --dry-run
```

## Required Capabilities

1. Create a scaffold under the fixed repository-local path `domain-packs/<id>/`.
2. Generate deterministic, reviewable text/configuration files containing:
   - domain-pack configuration;
   - branding placeholders;
   - workflow-type placeholders;
   - source-authority placeholders;
   - governance-rule placeholders;
   - an empty workflow-template collection;
   - example-query placeholders;
   - evaluation-case placeholders;
   - authoring instructions;
   - a focused starter test.
3. Validate the generated draft scaffold before writing it.
4. Support a dry-run mode that reports the exact target and files without creating directories or files.
5. Produce stable machine-readable CLI output.
6. Keep generated packs inactive until a human reviews and explicitly integrates them.

## Safety Requirements

- Accept only safe lowercase kebab-case ids.
- Reject traversal, separators, absolute paths, dot segments, unsafe characters, and oversized ids.
- Reject existing and operationally reserved ids.
- Refuse an existing target directory or file.
- Never overwrite an existing file.
- Do not accept an arbitrary output path from CLI input.
- Do not generate authoritative procedures.
- Do not fabricate laws, policies, deadlines, approvals, organizations, or responsible roles.
- Mark generated descriptions, branding, queries, evaluations, and instructions as draft or placeholder content.
- Set `authoritative` to `false` and scaffold status to `draft`.
- Do not register the generated pack in the runtime registry.
- Clean up only a target directory created by the current failed bootstrap attempt.

## Clean-Room Acceptance Test

The automated test must:

1. initialize a pack under a temporary test root;
2. validate the generated scaffold;
3. confirm the workflow-template collection is empty;
4. build an in-memory evaluation pack from draft placeholders;
5. run the starter evaluation successfully;
6. verify dry-run performs no writes;
7. verify unsafe, reserved, duplicate, and existing targets fail closed;
8. remove only the temporary test root it created.

## Runtime Boundary

Feature 048 does not:

- activate or publish generated packs;
- modify the public API;
- modify authentication;
- change database schema;
- add migrations;
- install dependencies;
- change GitHub Pages output;
- modify `dist-pages/`.

## Acceptance Criteria

- `npm run domain:init -- --id legal --name "Legal Procedure Assistant" --language es --dry-run` reports a deterministic scaffold plan without writing files.
- A normal run creates the complete draft scaffold exactly once.
- Repeating the run against the same target fails without overwriting content.
- The clean-room test validates and evaluates the generated draft pack.
- Existing domain packs and municipal behavior remain unchanged.
- The complete repository verification gate passes before the feature is marked `done`.
