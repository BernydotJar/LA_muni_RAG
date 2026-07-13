# Current Progress

## Active Feature

047-workflow-template-editor-foundation

## State

review

## Mode

MVP

## Summary

Feature 047 adds a controlled, validated JSON workflow-template editing foundation. It introduces a domain-neutral editable template contract, deterministic conversion from existing domain-pack templates, strict validation, a safe validation CLI, a reviewable municipal example, and compatibility tests that preserve current `municipal-antigua` workflow behavior.

## Verified Baseline

Before this feature:

- npm run typecheck: passed
- npm run build: passed
- npm run domain:evaluate: passed, 6/6 cases
- npm run test: 305 passed, 0 failed
- npm run build:pages: passed
- node scripts/verify-pages-artifact.mjs: passed

## Acceptance Focus

- Add a domain-neutral editable workflow-template contract.
- Validate domain ownership, workflow ids, step ids/order, labels/actions, documents, source authorities, governance rules, and evidence requirements.
- Reject unsafe ids, duplicates, unknown domain packs, unsupported authority/governance references, empty steps, and authoritative templates without evidence requirements.
- Add a safe JSON validation CLI that reads only repository-local `.json` files.
- Add a reviewable municipal example without changing runtime behavior.
- Preserve current Antigua classification and composition behavior.
- Do not execute imported content or auto-publish templates.
- Do not modify database schema or `dist-pages/`.

## Verification Required

```bash
npm run typecheck
npm run build
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
```
