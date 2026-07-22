# Local Procedure Case Portfolio

Feature 052 adds a browser-local portfolio over Procedure Case Workspace records created by Feature 051.

## Purpose

The dashboard gives an operator a consolidated view of local case workspaces:

- total cases;
- active cases;
- blocked cases;
- cases ready for review;
- cases marked completed operationally;
- document-state totals;
- progress by case;
- blockers, missing documents, assignees, and last activity.

## Local-only boundary

The dashboard reads only keys prefixed with:

```text
la-muni-rag:procedure-case:
```

It performs no network calls, analytics, API writes, corpus writes, or backend persistence.

Malformed records, unsupported schema versions, and records beyond configured bounds are ignored.

## Operational meaning

Portfolio metrics are operational signals only.

They do not establish:

- legal compliance;
- budget availability or execution;
- procurement compliance;
- Concejo Municipal or COCODE approval;
- document authenticity or sufficiency;
- reception, liquidation, payment, or formal project closure.

A case counted as `completed` means every local step was marked **Completado operativo**. It does not mean the underlying procedure or project is institutionally closed.

## Limits

The dashboard processes at most:

- 200 cases;
- 100 steps per case;
- 200 documents per step;
- 300 audit events per case.

Only `schemaVersion: 1` case workspaces are accepted.

## Filters and sorting

The dashboard supports:

- free-text search;
- procedure type;
- overall operational state;
- cases with blockers;
- recent activity windows;
- sorting by last update, title, or calculated progress.

Sorting uses deterministic tie breakers.

## Opening a case

`Abrir caso` sends a bounded LocalStorage key in the query string:

```text
procedure-workflow.html?caseKey=la-muni-rag:procedure-case:<hash>
```

`procedure-case-open.js` validates the key against the namespace and expected hash shape, reads only that local record, restores its bounded query, and submits the existing Procedure Workflow form. The workflow is regenerated only from a configured API response, after which Feature 051 restores the matching local workspace. Pages does not generate a static workflow.

The key is not treated as a file path, URL, API identifier, or server-side record.

## Export

The dashboard exports a consolidated JSON snapshot:

```json
{
  "portfolioSchemaVersion": 1,
  "exportedAt": "ISO-8601",
  "caseCount": 3,
  "cases": []
}
```

Feature 052 does not import portfolio files. Individual workspace import remains governed by Feature 051.

## Verification

```bash
npm run typecheck
npm run build
node --import tsx --test \
  src/__tests__/procedure-case-portfolio.test.ts \
  src/__tests__/procedure-case-workspace.test.ts \
  src/__tests__/procedure-deep-dive-ui.test.ts \
  src/__tests__/procedure-workflow-ui-cards.test.ts
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
git diff --check
```
