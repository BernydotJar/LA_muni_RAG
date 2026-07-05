# Design — 026-chat-answer-quality-and-evidence-composition

## Design Intent

Move the chat from “retrieval result dump” to “municipal assistant answer composition.”

The interaction pattern should be:

1. Answer or synthesis first.
2. Key findings second.
3. Verified evidence visible by default.
4. Follow-up chips for refinement.

## Files Allowed to Change

- `public/widget.js`
- `src/__tests__/premium-chat-widget.test.ts`
- `src/__tests__/chat-answer-composition.test.ts`
- `feature_list.json`
- `progress/current.md`
- `specs/026-chat-answer-quality-and-evidence-composition/*`

## Files Not to Touch

- Backend routes and APIs.
- Retrieval/evidence ranking code.
- Answer generation code.
- Database schema and migrations.
- Environment/secrets files.
- `public/index.html`.
- `public/glass-wall.html`.

## Composition Strategy

The frontend should treat `data.content` and `data.citations` as separate layers:

- `data.content`: possible answer text from API.
- `data.citations`: evidence objects used for traceability.

When `data.content` already contains a numbered source dump and `data.citations` exists, the widget should not repeat the dump in the primary answer. It should synthesize a compact response from:

- user query;
- citation count;
- evidence labels;
- citation excerpts;
- detected themes.

## UI Model

### Assistant Card

- `Respuesta con evidencia` kicker.
- Short synthesis paragraph.
- `Hallazgos clave` list with 2–4 bullets.
- `Fuentes verificadas` summary row.
- Evidence panel expanded by default.
- Optional hide control for compact reading.
- Follow-up chips.

### Evidence Panel

Default state: expanded.

Rationale: evidence is the core trust surface of the municipal assistant, so requiring an extra click adds friction. The toggle exists only to let users hide evidence after they have seen it.

When visible:

- show citation cards;
- keep source badge;
- keep evidence index;
- keep excerpt preview;
- allow card-level expansion.

### Follow-up Chips

Generate chips from detected themes:

- Agua potable
- Aguas residuales
- Aguas pluviales
- Acueducto/abastecimiento
- Necesidades locales
- Prioridades municipales

Fallback chips:

- Buscar frase exacta
- Ver necesidades locales
- Ver prioridades municipales

## No Backend Contract Change

The widget still sends:

```ts
{ message, mode: this.searchMode, limit: 5 }
```

No backend schema changes are required for this slice.
