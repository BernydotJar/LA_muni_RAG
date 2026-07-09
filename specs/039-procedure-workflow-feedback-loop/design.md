# Design — Procedure Workflow Feedback Loop

## Product Intent

Feature 036 created a structured `ProcedureWorkflow` object. Feature 037 rendered it as cards. Feature 038 exposed it from the widget. Feature 039 adds the first feedback loop around that outcome object.

The feedback loop is intentionally local/exportable in this MVP. It captures signal without introducing backend persistence, permissions, or sensitive data concerns.

## Implementation Shape

Add:

```text
public/procedure-feedback.js
```

Update:

```text
public/procedure-workflow.html
scripts/build-pages.mjs
scripts/verify-pages-artifact.mjs
```

## Event Contract

After rendering a workflow, `procedure-workflow.html` dispatches:

```js
window.dispatchEvent(new CustomEvent("procedure-workflow:rendered", { detail: { workflow } }));
```

`procedure-feedback.js` listens for this event and installs a feedback panel inside `#procedure-workflow`.

## Feedback Model

```ts
type ProcedureWorkflowFeedback = {
  id: string;
  createdAt: string;
  workflowId: string;
  workflowTitle: string;
  procedureType: string;
  jurisdiction: string;
  confidence: string;
  query: string;
  stepNumber: string;
  stepTitle: string;
  feedbackType: string;
  comment: string;
};
```

## Storage

Use localStorage only:

```text
la-muni-rag:procedure-feedback
```

No network calls are allowed in this MVP.

## UI

The module renders:

- feedback type select;
- step selector;
- comment textarea;
- save feedback button;
- copy JSON button;
- recent feedback count and list.

## Safety and Governance

- The UI tells users not to paste confidential information.
- The feedback is local to the browser.
- Feedback is a product signal, not municipal evidence.
- The module escapes dynamic text before rendering.

## Test Strategy

Static tests verify:

- page dispatches `procedure-workflow:rendered`;
- feedback script listens for the event;
- feedback script uses localStorage with a namespaced key;
- feedback script does not use `fetch`, `XMLHttpRequest`, or beacon APIs;
- feedback script renders feedback controls and export action;
- Pages build and verifier include the feedback script;
- documentation explains the AI-native feedback loop.
