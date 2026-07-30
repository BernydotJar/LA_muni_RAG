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
    assert.match(html, /domain-status-pill/);
    assert.match(html, /domain-eyebrow/);
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

  it("loads active domain-pack UI labels without allowing public pack switching", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /loadDomainPackUi/);
    assert.match(html, /fetch\("\/api\/domain-pack"/);
    assert.match(html, /applyDomainPackUi/);
    assert.match(html, /activeDomainPack/);
    assert.match(html, /workflow assistant/);
    assert.doesNotMatch(html, /domainPackId: new URLSearchParams|DOMAIN_PACK=/);
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

  it("routes procedure workflows through the fail-closed Pages API bridge", async () => {
    const bridge = await readSource("public/pages-api-bridge.js");

    assert.match(bridge, /"\/api\/procedure"/);
    assert.match(bridge, /"\/api\/domain-pack"/);
    assert.match(bridge, /approvedRoutes/);
    assert.match(bridge, /service_unavailable/);
    assert.match(bridge, /status: 503/);
    assert.doesNotMatch(bridge, /demoDomainPackResponse|demoProcedureResponse|procedureStep/);
  });
});
