# Requirements — 028-municipal-demo-readiness-and-evidence-copy-polish

## Mode

SHIP

## Goal

Finish the public-facing municipal demo experience by polishing the chat widget into an institutional, evidence-first assistant suitable for presentation to a municipality.

The product should feel less like a generic chatbot and more like a concise municipal documentary assistant: brief answer, key findings, visible sources, source relevance, traceability seal, and safe next actions.

## User Problem

The widget is visually strong and now separates synthesis from evidence, but the answer surface still needs institutional polish for a municipal demo:

- confidence labels can feel too technical or alarming;
- source excerpts may contain PDF hyphenation artifacts;
- source cards need clearer public-document metadata;
- evidence cards need a short explanation of why each source matters;
- the welcome state needs demo-ready prompts;
- the answer should explicitly communicate traceability and corpus boundaries.

## Scope

### In scope

- Improve `public/widget.js` answer copy and evidence presentation.
- Rename confidence labels into institutional evidence status labels.
- Clean visible excerpts for PDF hyphenation and spacing artifacts.
- Add public-document metadata to citation cards.
- Add relevance reason per source using safe frontend heuristics.
- Add traceability seal to each answer with evidence.
- Add demo-ready suggested prompts.
- Preserve chat API contract and current behavior.
- Add/adjust regression tests.
- Update harness tracking.

### Out of scope

- Backend API changes.
- Retrieval ranking changes.
- Answer generation prompt/model changes.
- Database, corpus, embeddings, migrations, auth, secrets, package files.
- Homepage and Glass Wall visual changes.

## Functional Requirements

- Preserve `/api/chat` request shape: `message`, `mode`, `limit`.
- Preserve `Palabras clave` and `Frase exacta` modes.
- Preserve evidence visible by default.
- Preserve evidence hide/show toggle.
- Preserve citation card expansion by click and keyboard.
- Preserve Shadow DOM isolation.
- Preserve open/close, Enter send, Escape close, responsive layout, and reduced-motion guardrails.
- Show institutional labels such as `Evidencia limitada` instead of raw `Confianza baja`.
- Show `Respuesta breve`, `Hallazgos principales`, and `Fuentes verificadas` hierarchy.
- Show source metadata: document, type, page when available, and evidence use.
- Show a safe relevance reason per source.
- Show a traceability seal for evidence-backed answers.
- Provide demo prompts suitable for a municipal presentation.

## Acceptance Criteria

- Widget includes municipal demo prompts.
- Assistant answer uses institutional sections.
- Confidence display uses evidence-status language.
- Citation excerpts are cleaned for hyphenation/spacing artifacts.
- Citation cards include metadata and relevance reason.
- Traceability seal is visible for evidence-backed responses.
- Existing API behavior remains unchanged.
- Tests protect the demo readiness surface.

## Verification Commands

Run locally before closing:

```sh
npm run typecheck
npm run build
npm run test
```
