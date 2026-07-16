# Feature 051 — Procedure Case Workspace

## Objective

Convert a rendered `ProcedureWorkflow` into a local operational workspace for follow-up without presenting user-entered progress as legal or institutional proof.

## Product boundary

The workspace is a planning and coordination surface. It does not modify the RAG response, procedure evidence, confidence, citations, authority classification, or case status asserted by the backend.

Operational completion never means legal, procurement, budgetary, council, COCODE, reception, liquidation, payment, or project closure approval.

## Data model

```ts
type CaseWorkspace = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  workflowSnapshot: {
    id: string;
    title: string;
    procedureType: string;
    jurisdiction: string;
    confidence: string;
    query: string;
  };
  steps: CaseWorkspaceStep[];
  auditLog: CaseAuditEvent[];
};

type CaseWorkspaceStep = {
  stepNumber: string;
  title: string;
  status: "not_started" | "in_progress" | "blocked" | "ready_for_review" | "completed";
  operationalAssignee: string;
  note: string;
  documents: Array<{ name: string; state: "missing" | "requested" | "received" | "reviewed" }>;
};
```

## Safety requirements

- LocalStorage only.
- No network write.
- Do not capture uploaded file contents.
- Do not infer assignees from workflow evidence.
- Do not treat checked documents as verified authenticity or legal sufficiency.
- Append audit events; do not silently rewrite history.
- Bound imported JSON size and validate schema and enum values.
- Escape all rendered user and workflow text.
- Warn users not to enter personal, confidential, reserved, credential, or secret information.

## UX

A workspace panel appears after a workflow renders and provides:

- create/open local workspace;
- progress summary;
- per-step operational status;
- document checklist;
- operational assignee and note;
- audit timeline;
- export JSON;
- import validated JSON;
- delete local workspace with explicit confirmation.

## Acceptance

- Existing overview and deep-dive UI remain functional.
- The workspace is namespaced by workflow id and query.
- State persists locally across reloads.
- Every material mutation creates an audit event.
- Tests verify local-only behavior, safety copy, escaping, schema validation, and Pages artifact inclusion.
