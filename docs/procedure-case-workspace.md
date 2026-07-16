# Procedure Case Workspace

Feature 051 adds a local operational follow-up layer to rendered Procedure Workflows.

## Purpose

The workspace helps a user coordinate follow-up after generating a workflow:

- mark operational step status;
- track whether listed documents are missing, requested, received, or reviewed operationally;
- record a user-entered operational assignee;
- write a bounded operational note;
- review an append-only local audit timeline;
- export and import a validated JSON snapshot.

## Critical boundary

The workspace is not municipal evidence and does not change the RAG answer.

A step marked **Completado operativo** does not prove:

- legal compliance;
- procurement approval;
- budget availability or execution;
- Concejo Municipal approval;
- COCODE approval;
- document authenticity or legal sufficiency;
- reception, liquidation, payment, or institutional project closure.

The operational assignee is entered by the user. It is not an authority extracted from a MOF, organigram, law, manual, act, or case file.

## Persistence

Data is stored only in browser LocalStorage under a workflow-specific key prefixed with:

```text
la-muni-rag:procedure-case:
```

The MVP performs no network write and does not upload document contents.

Do not enter personal data, confidential or reserved information, credentials, access tokens, secrets, or protected case material.

## Import contract

Imported JSON must:

- use `schemaVersion: 1`;
- contain at most 100 steps;
- contain at most 200 documents per step;
- contain at most 300 audit events;
- use supported step and document states;
- be no larger than 250 KB.

Text is normalized, bounded, and escaped before rendering.

## Audit behavior

Material changes append an audit event for:

- workspace creation/import;
- step status;
- operational assignee;
- note;
- document state.

The local audit log records UI mutations only. It is not a legally reliable chain of custody or institutional system of record.

## Verification

```bash
npm run typecheck
npm run build
node --import tsx --test \
  src/__tests__/procedure-case-workspace.test.ts \
  src/__tests__/procedure-deep-dive-ui.test.ts \
  src/__tests__/procedure-workflow-ui-cards.test.ts
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
git diff --check
```
