# Procedure Workflow Feedback Loop

## Purpose

Feature 039 adds a local/exportable feedback loop around the `ProcedureWorkflow` outcome object.

The goal is to capture product signal from users who review a workflow and notice missing evidence, unclear steps, missing deadlines, or case-specific gaps.

## Route

The loop is attached to:

```text
/procedure-workflow.html
```

## Script

```text
public/procedure-feedback.js
```

The procedure page dispatches:

```js
window.dispatchEvent(new CustomEvent("procedure-workflow:rendered", { detail: { workflow } }));
```

The feedback script listens for that event and renders a local feedback panel.

## Data captured

Each feedback item captures:

- created timestamp;
- workflow id;
- workflow title;
- procedure type;
- jurisdiction;
- confidence;
- source query;
- selected step number and title;
- feedback type;
- free-text comment.

## Storage

Feedback is stored only in the browser:

```text
la-muni-rag:procedure-feedback
```

No network request is made in this MVP.

## Export

The UI includes a `Copiar feedback JSON` action. This gives the team a manual review path without introducing backend persistence yet.

## Governance note

Feedback is product signal, not municipal evidence. Users are warned not to paste confidential, personal, secret, or reserved information.

## AI-native operating model

This feature implements the AI-native principle that products should improve around an outcome object. Here the outcome object is `ProcedureWorkflow`; the feedback loop identifies what evidence, steps, documents, or validation checks should be improved next.

## Future backend path

A later feature can add:

- authenticated `POST /api/procedure-feedback`;
- persistence table;
- review dashboard;
- feedback status workflow;
- analytics over missing documents;
- evaluator tests for repeated workflow gaps.
