# Procedure Workflow Advisor

## Purpose

The Procedure Workflow Advisor extends LA Muni RAG from evidence search into structured municipal procedure guidance. It is designed for Antigua Guatemala and answers procedural questions with evidence-grounded workflows.

It can organize questions such as:

- how to build a municipal stadium;
- how to close or liquidate a municipal work;
- what documents are needed for procurement or public works;
- what is missing in a case file such as a school project;
- whether a COCODE, Concejo Municipal, technical unit, budget file, or project manager approval appears in the evidence.

## Antigua-first rule

This assistant is for Antigua Guatemala. It prioritizes official Antigua documents and national law. Documents from other municipalities may be used only as comparative references.

If a Mixco manual or another municipal procedure manual is used, the response must state that it is not official Antigua procedure unless corroborated by Antigua documents or national law.

## Response shape

The API returns a `ProcedureWorkflow` with:

- summary;
- jurisdiction;
- procedure type;
- confidence;
- classification;
- workflow steps;
- required documents;
- output documents;
- citations per step;
- gaps;
- validation warning.

## API

```text
GET /api/procedure?q=<query>&mode=keyword&limit=8
```

Example:

```text
/api/procedure?q=Qué hay que hacer para construir un estadio municipal&mode=keyword&limit=8
```

## Safety behavior

The advisor does not invent:

- deadlines;
- signatures;
- current project status;
- COCODE routes;
- Concejo approval steps;
- case-specific closure state;
- documents not present in evidence.

Unsupported elements are returned as gaps.

## Example gaps

For “¿Qué falta para cerrar la obra de la escuela de San Mateo?”, if no case file exists in the retrieved evidence, the advisor lists required documents such as:

- contract;
- final reception act;
- supervision reports;
- payment estimates;
- liquidation;
- budget file;
- council point or minutes if applicable;
- community/COCODE evidence if required by the case.

It must not say that the work is actually open, closed, approved, delayed, or liquidated without case evidence.

## Current limitations

- MVP only; no visual workflow UI yet.
- No automatic ingestion of new PDFs in this feature.
- No legal advice as final authority.
- Retrieval ranking is unchanged.
- Workflow templates are conservative and must be validated by municipal legal/technical staff.
