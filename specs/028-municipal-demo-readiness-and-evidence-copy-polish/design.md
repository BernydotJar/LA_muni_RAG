# Design — 028-municipal-demo-readiness-and-evidence-copy-polish

## Design Intent

Prepare the widget for a municipal presentation by shifting the surface from “RAG chat” to “municipal documentary assistant.”

The answer pattern should be:

1. `Respuesta breve`
2. `Hallazgos principales`
3. `Fuentes verificadas`
4. Source metadata + relevance reason
5. Traceability seal
6. Next actions

## Files Allowed to Change

- `public/widget.js`
- `src/__tests__/premium-chat-widget.test.ts`
- `src/__tests__/chat-answer-composition.test.ts`
- `src/__tests__/municipal-demo-readiness.test.ts`
- `feature_list.json`
- `progress/current.md`
- `specs/028-municipal-demo-readiness-and-evidence-copy-polish/*`

## Files Not to Touch

- Backend routes and APIs.
- Retrieval/evidence ranking code.
- Answer generation code.
- Database schema and migrations.
- Environment/secrets files.
- `public/index.html`.
- `public/glass-wall.html`.

## Copy Model

### Confidence / Evidence Status

Do not show raw `Confianza baja` as the primary label. Use institutional evidence status labels:

- `Evidencia sólida`
- `Evidencia suficiente`
- `Evidencia limitada`

This keeps the system honest without making a demo audience think the product is broken.

### Source Cards

Each source card should include:

- source type badge;
- evidence number;
- citation label;
- metadata rows;
- cleaned excerpt;
- relevance reason.

### Excerpt Cleaning

The frontend should clean common PDF extraction artifacts visible to the user:

- hyphenated line breaks;
- repeated whitespace;
- broken spacing around punctuation;
- excessively long snippets.

### Traceability Seal

Each evidence-backed answer should include a short institutional trust seal:

- based on municipal documents;
- evidence visible;
- no external corpus claim.

### Demo Prompts

Welcome suggestions should include stable, presentation-friendly prompts:

- `¿Cuáles son las necesidades más urgentes?`
- `¿Qué dice el PDM-OT sobre agua?`
- `¿Qué prioridades municipales aparecen en el documento?`

## No Backend Contract Change

The widget still sends:

```ts
{ message, mode: this.searchMode, limit: 5 }
```
