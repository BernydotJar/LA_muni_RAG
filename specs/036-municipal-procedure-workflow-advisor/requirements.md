# Feature 036 — Municipal Procedure Workflow Advisor

## Mode

MVP

## Objective

Evolve LA Muni RAG from document search with citations into a municipal procedure workflow advisor. The advisor must answer procedural questions with structured, actionable workflows grounded in evidence.

Example questions:

- ¿Qué hay que hacer para construir un estadio municipal?
- ¿Cómo se cierra una obra municipal?
- ¿Qué falta para cerrar la obra de la escuela de San Mateo?
- ¿Qué documentos necesita una licitación pública para una obra?
- ¿Quién firma, quién aprueba, qué se manda al Concejo, qué pasa por COCODE y qué plazo aplica?

## Core Requirements

1. Detect procedural questions and classify them by procedure type.
2. Compose a structured workflow with steps, responsible roles, required documents, outputs, decision points, deadlines, gaps, and citations.
3. Use the existing evidence retrieval layer; do not change retrieval ranking in this MVP.
4. Do not invent procedures, deadlines, signatures, project status, COCODE routes, or approval chains.
5. If evidence is insufficient, clearly mark the step as low confidence, inferred, or missing.
6. If no case-specific evidence exists, say that the case file is missing and list the documents needed to determine status.
7. Prioritize official Antigua Guatemala documents when available.
8. Use other municipal manuals, such as Mixco, only as `external_reference` or comparative municipal procedure examples.
9. Never present an external municipal manual as official Antigua procedure unless the same step is supported by national law or Antigua documents.
10. Keep answers in Spanish.
11. Include explicit human validation language for legal/procedural use.
12. Add an API entry point for structured procedure workflow responses.

## Source Authority Rules

Source classes:

- `national_law`: national law, regulation, decree, national standard.
- `municipal_code`: Código Municipal.
- `municipal_manual`: Antigua municipal manual or procedure manual.
- `mof`: Manual de Organización y Funciones.
- `organigram`: municipal organizational chart.
- `pdm_ot`: Plan de Desarrollo Municipal y Ordenamiento Territorial.
- `pom_poa`: POM, POA, operational planning.
- `budget`: budget or execution reports.
- `council_minutes`: council minutes or council points.
- `community_file`: COCODE, community files, village needs.
- `case_file`: specific case file, such as Escuela de San Mateo.
- `war_room`: proposal/cost/KPI planning source, not normative authority.
- `external_reference`: another municipality or external procedural reference.
- `unknown`: insufficient metadata.

## Antigua-first Rule

The advisor is for Antigua Guatemala. It must search and reason first over Antigua official material. If no equivalent Antigua procedure is available, the advisor may use documents from other municipalities as a comparative reference and must state:

> Este flujo se basa en una referencia de otra municipalidad; debe validarse contra documentos oficiales de Antigua Guatemala y normativa nacional aplicable.

## Response Contract

A procedure response must include:

1. Executive summary.
2. Procedure workflow steps.
3. Responsible role or unit per step, when cited.
4. Required documents per step.
5. Output documents per step.
6. Legal/documentary basis per step.
7. Deadlines only when explicitly cited.
8. Dependencies and decision points.
9. Gaps and missing documents.
10. Confidence at workflow and step level.
11. Citations per step.
12. Human validation warning.

## Non-goals

- No legal advice as final authority.
- No ingestion of new PDFs in this feature.
- No UI workflow cards yet.
- No PDF viewer.
- No change to retrieval ranking.
- No claim about the current state of any work project without case evidence.
