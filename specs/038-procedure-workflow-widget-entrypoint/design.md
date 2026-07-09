# Design — Procedure Workflow Widget Entrypoint

## Product Intent

The current chat widget is good for evidence-backed Q&A. The Procedure Workflow UI is better for operational questions that need a step-by-step flow.

Feature 038 adds a small bridge between both surfaces: a visible entrypoint inside the widget header/welcome area that opens the workflow page.

## Implementation Shape

Add:

```text
public/procedure-widget-entrypoint.js
```

The script:

1. Reads configuration from its own script tag:
   - `data-procedure-url`, optional.
2. Defaults to `./procedure-workflow.html` relative to the current page.
3. Waits for `#muni-rag-widget`.
4. Accesses the widget open Shadow DOM.
5. Inserts:
   - a rail pill in `.muni-header-rail`;
   - a welcome suggestion in `.muni-suggestions`.
6. Uses `window.open(procedureUrl, "_self")` to navigate.
7. Does nothing if the widget or shadow root is absent.
8. Avoids duplicates using `data-procedure-workflow-entrypoint="true"`.
9. Disconnects its observer after successful install or after a bounded timeout.

## Why Separate Script Instead of Modifying Widget

`public/widget.js` is compact and already covered by multiple contracts. A separate enhancement script lowers regression risk and preserves the core widget contract.

## GitHub Pages

`build-pages.mjs` injects the entrypoint after `widget.js` when preparing `dist-pages`. The verifier requires `procedure-widget-entrypoint.js` in the artifact.

## AI-Native Operating Model Integration

The attached transcript is integrated as documentation, not as municipal evidence. It informs the product direction:

- capture signal;
- govern access;
- expose safe internal APIs;
- design around outcome objects;
- use feedback loops;
- use simulators/evaluators to guide the user to the next action.

For LA Muni RAG, the outcome object is the `ProcedureWorkflow`: it can be reviewed, copied, improved with evidence, and used as a workflow artifact rather than just a chat answer.

## Test Strategy

Static tests verify:

- entrypoint script exists;
- it targets the widget Shadow DOM;
- it uses `/procedure-workflow.html` as the default destination;
- it avoids duplicates;
- it uses a bounded observer;
- Pages build injects and verifies the new script;
- AI-native operating model documentation exists and includes the attached transcript principles.
