# Feature 038 — Procedure Workflow Widget Entrypoint

## Mode

MVP

## Objective

Add a lightweight entrypoint from the existing embeddable chat widget surface into the dedicated Procedure Workflow UI introduced in Feature 037.

The goal is not to replace chat. The goal is to expose a clear next action when the user needs a municipal workflow instead of a conversational answer.

## User Need

A user visiting the public RAG page should be able to discover:

- normal chat for documentary questions;
- Procedure Workflow Advisor for step-by-step municipal flows.

## Requirements

1. Add a small frontend script that augments the existing widget when its open Shadow DOM is available.
2. The script must not modify `public/widget.js` directly.
3. The script must not break the existing `/api/chat` widget contract.
4. The script must insert a visible entrypoint labeled for procedural flows.
5. The entrypoint must open `/procedure-workflow.html` by default.
6. The URL must be configurable through `data-procedure-url`.
7. The script must be safe when the widget is not present.
8. The script must avoid duplicate entrypoints.
9. The script must use a bounded observer/timer and then stop.
10. GitHub Pages build output must include the entrypoint script next to the widget.
11. Do not modify `src/procedure/*`.
12. Do not touch generated `dist-pages/` artifacts.

## AI-Native Integration Requirement

Integrate the attached AI-native company transcript as a product operating model document for this repo.

The document should extract principles relevant to this RAG product:

- AI-native is culture, not only tooling.
- Company activity should become machine-readable signal.
- Internal knowledge requires governance and safe API access.
- Products should be designed around an outcome object that improves with feedback.
- Simulation and evaluation loops can guide users to the next best lesson/action.
- Everyone in an AI-native operating model creates small improvements.

## Non-goals

- No chat classifier in this feature.
- No automatic redirect based on user query.
- No backend changes.
- No generated build artifact commits.
