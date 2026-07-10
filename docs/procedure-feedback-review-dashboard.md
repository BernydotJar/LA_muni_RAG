# Procedure Feedback Review Dashboard

## Purpose

Feature 040 adds a local review dashboard for feedback captured around `ProcedureWorkflow` outputs.

Route:

```text
/procedure-feedback-dashboard.html
```

## Data source

The dashboard reads only from browser localStorage:

```text
la-muni-rag:procedure-feedback
```

It does not call the backend, send telemetry, or persist data remotely.

## What it shows

- total feedback count;
- unique workflow count;
- missing-document feedback count;
- missing legal basis / deadline count;
- feedback cards with workflow title, query, procedure type, jurisdiction, confidence, selected step, feedback type, comment, and timestamp;
- comparative warning on cards whose workflow jurisdiction is `external reference`;
- filters by type and free-text search.

## Actions

- Copy filtered JSON.
- Copy all JSON.
- Clear local feedback after confirmation.

## Governance

Feedback is product signal, not municipal evidence. It should be reviewed by the team before becoming corpus changes, procedure template changes, documentation, or UX work.

If feedback comes from a workflow marked as `external reference`, treat it as comparative signal only. Another municipality's manual may show structure, but the team must validate it against official Antigua Guatemala documents and applicable national legislation before using it as procedure.

Users should not paste personal data, secrets, confidential municipal records, or reserved information into local feedback comments.

## Future backend path

A later feature can add:

- authenticated backend submission;
- role-based review dashboard;
- feedback lifecycle states;
- missing-document analytics;
- issue creation from repeated gaps;
- evaluator tests derived from feedback trends.
