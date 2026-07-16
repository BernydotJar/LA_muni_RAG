import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KeywordSearchResult } from "../search.js";
import { buildProcedureWorkflowWithDependencies } from "../procedure/index.js";
import { readFile } from "node:fs/promises";

const result = (
  documentTitle: string,
  documentType: string,
  citationLabel: string,
  snippet: string,
  sourceUrl: string | null = null
): KeywordSearchResult => ({
  documentTitle,
  documentType,
  citationLabel,
  pageStart: 1,
  keywordScore: 0.1,
  snippet,
  sourceUrl,
});

const dependenciesFor = (results: KeywordSearchResult[]) => ({
  keywordSearch: async () => results,
});

describe("procedure official source attribution", () => {
  it("identifies and names an official municipal source for the matching step", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Cómo validar planificación y presupuesto de una obra municipal?",
      "keyword",
      8,
      dependenciesFor([
        result(
          "PDM-OT Antigua Guatemala",
          "pdm_ot",
          "PDM-OT Antigua Guatemala, página 170",
          "La planificación territorial establece programas y proyectos municipales.",
          "https://muniantigua.gob.gt/documentos/pdm-ot.pdf"
        ),
      ]),
      undefined,
      "deep_dive"
    );

    const step = workflow.steps.find((item) => item.sourceAttribution?.status === "official_municipal");
    assert.ok(step);
    assert.match(step.sourceAttribution!.heading, /PDM-OT Antigua Guatemala/i);
    assert.match(step.sourceAttribution!.statement, /fuente municipal oficial|PDM-OT/i);
    assert.equal(step.sourceAttribution!.primaryCitation?.authorityLevel, "primary");
    assert.equal(step.sourceAttribution!.primaryCitation?.sourceUrl, "https://muniantigua.gob.gt/documentos/pdm-ot.pdf");
    assert.doesNotMatch(step.sourceAttribution!.statement, /Requiere validación contra fuente oficial de Antigua Guatemala/);
  });

  it("distinguishes a national legal basis from a municipal internal procedure", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Cómo definir modalidad de contratación para una obra?",
      "keyword",
      8,
      dependenciesFor([
        result(
          "Ley de Contrataciones del Estado",
          "law",
          "Ley de Contrataciones, artículo 38",
          "La modalidad se determina conforme al monto y objeto de la contratación."
        ),
      ]),
      undefined,
      "deep_dive"
    );

    const step = workflow.steps.find((item) => item.sourceAttribution?.status === "official_national");
    assert.ok(step);
    assert.match(step.sourceAttribution!.heading, /Base nacional aplicable/i);
    assert.match(step.sourceAttribution!.statement, /corroborarse.*fuente local|práctica interna municipal/i);
    assert.equal(step.sourceAttribution!.primaryCitation?.authorityLevel, "national");
  });

  it("keeps another municipality's material visibly comparative", async () => {
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

    const step = workflow.steps.find((item) => item.sourceAttribution?.status === "comparative");
    assert.ok(step);
    assert.match(step.sourceAttribution!.heading, /Referencia comparativa/i);
    assert.match(step.sourceAttribution!.statement, /no define.*procedimiento oficial de Antigua Guatemala/i);
    assert.equal(step.evidenceStatus, "inferred");
  });

  it("uses insufficiency only when no matching citation exists", async () => {
    const workflow = await buildProcedureWorkflowWithDependencies(
      "¿Qué documentos necesita una licitación pública para una obra?",
      "keyword",
      8,
      dependenciesFor([]),
      undefined,
      "deep_dive"
    );

    assert.ok(workflow.steps.every((step) => step.sourceAttribution?.status === "insufficient"));
    assert.ok(workflow.steps.every((step) => step.sourceAttribution?.citations.length === 0));
    assert.ok(workflow.steps.every((step) => step.evidenceStatement === "No encontré base documental suficiente para afirmar este paso."));
  });

  it("loads a progressive source attribution renderer with safe links", async () => {
    const feedback = await readFile("public/procedure-feedback.js", "utf-8");
    const renderer = await readFile("public/procedure-source-attribution.js", "utf-8");

    assert.match(feedback, /procedure-source-attribution\.js/);
    assert.match(renderer, /official_municipal/);
    assert.match(renderer, /official_national/);
    assert.match(renderer, /Referencia comparativa/);
    assert.match(renderer, /Abrir fuente oficial/);
    assert.match(renderer, /url\.protocol === "http:" \|\| url\.protocol === "https:"/);
    assert.match(renderer, /noopener noreferrer/);
    assert.match(renderer, /textContent/);
  });
});