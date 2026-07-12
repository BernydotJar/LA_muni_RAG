import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("procedure workflow UI cards", () => {
  it("adds a dedicated Spanish procedure workflow page", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /Flujo procedimental/);
    assert.match(html, /Procedure Workflow Advisor/);
    assert.match(html, /Antigua-first/);
    assert.match(html, /Del documento al <span>paso a paso/);
    assert.match(html, /procedure-workflow-form/);
    assert.match(html, /procedure-query/);
  });

  it("calls the structured procedure API with query, mode, and limit", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /\/api\/procedure\?\$\{params\.toString\(\)\}/);
    assert.match(html, /new URLSearchParams\(\{ q: query, mode, limit \}\)/);
    assert.match(html, /headers: \{ accept: "application\/json" \}/);
    assert.match(html, /renderProcedureWorkflow\(await response\.json\(\)\)/);
  });

  it("renders workflow cards, documents, citations, gaps, and validation warning", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /procedure-step-card/);
    assert.match(html, /procedure-gap-card/);
    assert.match(html, /citation-chip/);
    assert.match(html, /Documentos requeridos/);
    assert.match(html, /Salidas \/ entregables/);
    assert.match(html, /Brechas y documentos faltantes/);
    assert.match(html, /Validación humana requerida/);
    assert.match(html, /copy-procedure-checklist/);
    assert.match(html, /dominio:/);
    assert.match(html, /domainPackName/);
  });

  it("escapes dynamic workflow content before rendering", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /const esc = \(value\) =>/);
    assert.match(html, /div\.textContent = String\(value \?\? ""\)/);
    assert.match(html, /esc\(workflow\.title/);
    assert.match(html, /esc\(step\.title/);
    assert.match(html, /esc\(gap\.missingItem/);
  });

  it("extends the GitHub Pages demo bridge for procedure workflows", async () => {
    const bridge = await readSource("public/pages-demo-api.js");

    assert.match(bridge, /isProcedureRequest/);
    assert.match(bridge, /\/api\/procedure/);
    assert.match(bridge, /demoProcedureResponse/);
    assert.match(bridge, /procedureStep/);
    assert.match(bridge, /Procedure Workflow|Flujo procedimental|procedure_workflow_advisor_mvp/);
    assert.match(bridge, /sourceUrl: null/);
  });
});
