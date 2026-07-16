import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { KeywordSearchResult } from "../search.js";
import { classifyProcedureQuery } from "../procedure/procedureClassifier.js";
import { buildProcedureWorkflowWithDependencies } from "../procedure/index.js";

const result = (
  documentTitle: string,
  documentType: string,
  citationLabel: string,
  snippet: string,
  score = 0.08
): KeywordSearchResult => ({
  documentTitle,
  documentType,
  citationLabel,
  pageStart: 10,
  keywordScore: score,
  snippet,
  sourceUrl: null,
});

const dependenciesFor = (results: KeywordSearchResult[]) => ({
  keywordSearch: async () => results,
});

describe("procedure workflow advisor", () => {
  it("classifies stadium construction as a planning project", () => {
    const classification = classifyProcedureQuery("¿Qué hay que hacer para construir un estadio municipal?");

    assert.equal(classification.isProcedural, true);
    assert.equal(classification.intent, "planning_project");
    assert.equal(classification.procedureType, "public_works");
    assert.equal(classification.mentionsExternalMunicipality, false);
    assert.ok(classification.intentSignals.includes("planning_or_project_language"));
  });

  it("distinguishes documentary, legal, procedural, case, planning, and closure intents", () => {
    assert.equal(classifyProcedureQuery("Muéstrame el organigrama municipal vigente.").intent, "documentary");
    assert.equal(classifyProcedureQuery("¿Qué ley y artículo regulan las licitaciones públicas?").intent, "legal");
    assert.equal(classifyProcedureQuery("¿Quién firma y quién aprueba una licitación pública?").intent, "procedural");
    assert.equal(classifyProcedureQuery("¿Cuál es el estado actual de la obra de la escuela de San Mateo?").intent, "case_specific");
    assert.equal(classifyProcedureQuery("¿Cómo se planifica y presupuesta un proyecto municipal?").intent, "planning_project");
    assert.equal(classifyProcedureQuery("¿Cómo se cierra y liquida una obra municipal?").intent, "closure_liquidation");
  });

  it("uses deterministic precedence for closure and named-case queries", () => {
    const closure = classifyProcedureQuery("¿Qué falta para cerrar la obra de la escuela de San Mateo?");
    assert.equal(closure.intent, "closure_liquidation");
    assert.ok(closure.intentSignals.includes("named_case"));
    assert.ok(closure.intentSignals.includes("current_status_request"));

    const caseSpecific = classifyProcedureQuery("¿Cuál es el estado actual de la obra de la escuela de San Mateo?");
    assert.equal(caseSpecific.intent, "case_specific");
    assert.equal(caseSpecific.caseName, "Escuela de San Mateo");
  });

  it("builds a conservative public works workflow with gaps and citations", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué hay que hacer para construir un estadio municipal?",
      "keyword",
      6,
      dependenciesFor([
        result(
          "Plan de Desarrollo Municipal y Ordenamiento Territorial - Antigua Guatemala",
          "plan",
          "PDM-OT Antigua Guatemala, página 170",
          "El plan vincula proyectos municipales con planificación territorial, prioridades, programas y acciones de desarrollo."
        ),
        result(
          "Presupuesto anual de egresos 2025 Antigua Guatemala",
          "budget",
          "Presupuesto anual, página 22",
          "El presupuesto municipal contiene asignaciones y renglones de egreso para programas y proyectos."
        ),
      ])
    );

    assert.equal(workflow.procedureType, "public_works");
    assert.equal(workflow.classification.intent, "planning_project");
    assert.equal(workflow.jurisdiction, "Antigua Guatemala");
    assert.ok(workflow.steps.length >= 6);
    assert.ok(workflow.steps.some((step) => step.title.includes("Clasificar")));
    assert.ok(workflow.steps.some((step) => step.requiredDocuments.includes("PDM-OT")));
    assert.ok(workflow.citations.length > 0);
    assert.match(workflow.validationWarning, /validación/);
  });

  it("does not invent current status for San Mateo closure", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué falta para cerrar la obra de la escuela de San Mateo?",
      "keyword",
      6,
      dependenciesFor([])
    );

    assert.equal(workflow.procedureType, "project_closure");
    assert.equal(workflow.classification.intent, "closure_liquidation");
    assert.equal(workflow.classification.caseName, "Escuela de San Mateo");
    assert.match(workflow.summary, /No encontré evidencia suficiente|expediente específico/i);
    assert.ok(workflow.gaps.some((gap) => gap.missingItem.includes("Contrato de obra")));
    assert.ok(workflow.gaps.some((gap) => gap.missingItem.includes("Acta de recepción final")));
    assert.ok(workflow.gaps.some((gap) => gap.requiredToConfirm.includes("Escuela de San Mateo")));
  });

  it("labels Mixco material as external reference and not official Antigua procedure", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "Usa el manual de Mixco para explicar cómo funciona una contratación de obra.",
      "keyword",
      6,
      dependenciesFor([
        result(
          "Manual de Normas y Procedimientos de Adquisiciones y Contrataciones Municipalidad de Mixco",
          "manual",
          "Manual Mixco, página 30",
          "Procedimiento de cotización y licitación pública para obras registradas en SNIP."
        ),
      ])
    );

    assert.equal(workflow.procedureType, "procurement");
    assert.equal(workflow.metadata.hasExternalReference, true);
    assert.equal(workflow.metadata.hasAntiguaEvidence, false);
    assert.equal(workflow.jurisdiction, "external reference");
    assert.match(workflow.summary, /referencia procedimental de otra municipalidad/i);
    assert.ok(workflow.gaps.some((gap) => gap.missingItem.includes("Antigua")));
  });

  it("does not invent exact COCODE deadlines", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Cuántos días exactos tarda COCODE en aprobar una obra?",
      "keyword",
      5,
      dependenciesFor([
        result(
          "Fichas comunitarias Antigua Guatemala",
          "community_file",
          "Ficha comunitaria, página 12",
          "La comunidad prioriza obras y necesidades locales para gestión municipal."
        ),
      ])
    );

    assert.equal(workflow.classification.asksForExactDeadline, true);
    assert.ok(workflow.gaps.some((gap) => gap.missingItem.includes("Plazo explícito")));
    assert.ok(workflow.steps.every((step) => !step.deadline));
  });
});
