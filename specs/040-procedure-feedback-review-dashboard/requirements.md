# Feature 040 — Procedure Feedback Review Dashboard

## Mode

MVP

## Objective

Add a local review dashboard for feedback captured by Feature 039. The dashboard lets the team inspect, filter, copy, and clear locally stored `ProcedureWorkflow` feedback without adding backend persistence yet.

## User Need

After municipal users or team members review workflows and leave feedback, the team needs a simple place to review that signal:

- Which workflows receive feedback?
- Which feedback types are most common?
- Which steps are repeatedly unclear?
- What comments should become corpus, template, or UX follow-up tasks?

## Requirements

1. Add a public dashboard page:

```text
public/procedure-feedback-dashboard.html
```

2. The dashboard must read only from localStorage key:

```text
la-muni-rag:procedure-feedback
```

3. The dashboard must not send data to the network.
4. It must render summary metrics:
   - total feedback count;
   - unique workflow count;
   - missing document count;
   - missing legal/deadline count.
5. It must render feedback cards with workflow title, procedure type, jurisdiction, confidence, selected step, feedback type, comment, and timestamp.
6. It must provide filters for feedback type and free-text search.
7. It must provide copy/export JSON action.
8. It may provide a clear-local-feedback action, with confirmation copy in the UI.
9. It must escape dynamic content before rendering.
10. Link to the dashboard from the procedure workflow page.
11. Include the dashboard in GitHub Pages build and verification.
12. Do not modify `src/procedure/*` backend logic.
13. Do not touch generated `dist-pages/` artifacts.

## Non-goals

- No backend persistence.
- No authentication.
- No POST API.
- No admin role model.
- No charts library.
- No server-side analytics.
