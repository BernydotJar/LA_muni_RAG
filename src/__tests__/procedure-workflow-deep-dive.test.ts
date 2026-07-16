import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeywordSearchResult } from "../search.js";
import { buildProcedureWorkflowWithDependencies } from "../procedure/index.js";

const result = (
  documentTitle: string,
  documentType: string,
  citationLabel: string,
  snippet: string
): KeywordSearchResult => ({
  documentTitle,
  documentType,
  citationLabel,
  pageStart: 1,
  keywordScore: 0.1,
  snippet,
  sourceUrl: null,
});

const dependenciesFor = (results: KeywordSearchResult[]) => ({
  keywordSearch: async () => results,
});

describe("procedure workflow deep dive", () => {
  it("preserves overview as the default response depth", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué hay que hacer para construir un estadio municipal?",
      "keyword",
      8,
      dependenciesFor([])
    );

    assert.equal(workflow.metadata.depth, "overview");
    assert.equal(workflow.metadata.generatedBy, "procedure_workflow_advisor_mvp");
    assert.equal(workflow.dependencies, undefined);
  });

  it("adds dependencies and per-step evidence status in deep-dive mode", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué hay que hacer para construir un estadio municipal?",
      "keyword",
      8,
      dependenciesFor([
        result(
          "PDM-OT Antigua Guatemala",
          "pdm_ot",
          "PDM-OT, página 170",
          "La planificación territorial establece prioridades, programas y proyectos municipales."
        ),
      ]),
      undefined,
      "deep_dive"
    );

    assert.equal(workflow.metadata.depth, "deep_dive");
    assert.equal(workflow.metadata.generatedBy, "procedure_workflow_advisor_deep_dive_v1");
    assert.equal(workflow.dependencies?.length, workflow.steps.length - 1);
    assert.ok(workflow.steps.every((step) => step.evidenceStatus));
    assert.ok(workflow.steps.every((step) => step.evidenceStatement));
  });

  it("does not attach unrelated citations to unsupported steps", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué documentos necesita una licitación pública para una obra?",
      "keyword",
      8,
      dependenciesFor([
        result(
          "Presupuesto anual Antigua Guatemala",
          "budget",
          "Presupuesto, página 22",
          "Asignaciones presupuestarias por programa y proyecto."
        ),
      ]),
      undefined,
      "deep_dive"
    );

    const unsupported = workflow.steps.filter((step) => step.evidenceStatus === "insufficient");
    assert.ok(unsupported.length > 0);
    assert.ok(unsupported.every((step) => step.sourceEvidence.length === 0));
    assert.ok(
      unsupported.every(
        (step) => step.evidenceStatement === "No encontré base documental suficiente para afirmar este paso."
      )
    );
  });

  it("keeps external municipal material comparative", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "Usa el manual de Mixco para explicar una contratación de obra.",
      "keyword",
      8,
      dependenciesFor([
        result(
          "Manual de adquisiciones Municipalidad de Mixco",
          "municipal_manual",
          "Manual Mixco, página 30",
          "Flujo de licitación pública de la Municipalidad de Mixco."
        ),
      ]),
      undefined,
      "deep_dive"
    );

    assert.equal(workflow.jurisdiction, "external reference");
    assert.equal(workflow.metadata.hasAntiguaEvidence, false);
    assert.equal(workflow.confidence, "low");
    assert.ok(workflow.steps.every((step) => step.evidenceStatus !== "supported"));
  });

  it("does not invent case status, roles, approvals, or deadlines without evidence", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué falta para cerrar la obra de la escuela de San Mateo y quién aprueba en cuántos días?",
      "keyword",
      8,
      dependenciesFor([]),
      undefined,
      "deep_dive"
    );

    assert.equal(workflow.confidence, "low");
    assert.ok(workflow.steps.every((step) => !step.deadline));
    assert.ok(workflow.steps.every((step) => !step.responsibleRole));
    assert.ok(workflow.steps.every((step) => !step.responsibleUnit));
    assert.ok(workflow.steps.every((step) => step.evidenceStatus === "insufficient"));
    assert.match(workflow.summary, /expediente|evidencia suficiente/i);
  });
});
