# Procedure Workflow Widget Entrypoint

## Purpose

`public/procedure-widget-entrypoint.js` progressively enhances the existing chat widget by adding a route into the Procedure Workflow UI.

The widget remains a chat surface. The new entrypoint tells users that operational/procedural questions can be handled as a structured workflow artifact.

## Usage

Include after the widget script:

```html
<script src="/widget.js"></script>
<script src="/procedure-widget-entrypoint.js"></script>
```

Optional custom target:

```html
<script src="/procedure-widget-entrypoint.js" data-procedure-url="/procedure-workflow.html"></script>
```

## Behavior

The script:

- waits for `#muni-rag-widget`;
- reads the widget open Shadow DOM;
- adds a `Flujos` pill to the widget rail;
- adds a `Generar flujo procedimental paso a paso` suggestion to the welcome card;
- opens the procedure workflow page;
- avoids duplicate entrypoints;
- disconnects after install or after a bounded timeout.

## Contract

- It does not alter `/api/chat`.
- It does not modify `public/widget.js`.
- It is safe if the widget is not present.
- It does not require backend changes.

## GitHub Pages

`build-pages.mjs` injects this script into the static artifact after `widget.js`, and `verify-pages-artifact.mjs` verifies the file and injection.
