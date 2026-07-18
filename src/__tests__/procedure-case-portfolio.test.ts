import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("local procedure case portfolio", () => {
  it("adds a complete Spanish local portfolio shell", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");

    assert.match(html, /Portafolio local de casos/);
    assert.match(html, /Señales operativas, no dictamen institucional/);
    assert.match(html, /Volver a flujos/);
    assert.match(html, /id="case-list"/);
    assert.match(html, /class="metric-grid"/);
    assert.match(html, /procedure-case-portfolio\.css/);
    assert.match(html, /procedure-case-portfolio-data\.js/);
    assert.match(html, /procedure-case-portfolio\.js/);
    assert.match(html, /<\/body>\s*<\/html>/);
  });

  it("reads only bounded namespaced LocalStorage records", async () => {
    const dataRuntime = await readSource("public/procedure-case-portfolio-data.js");

    assert.match(dataRuntime, /la-muni-rag:procedure-case:/);
    assert.match(dataRuntime, /MAX_CASES=200/);
    assert.match(dataRuntime, /MAX_STEPS=100/);
    assert.match(dataRuntime, /MAX_DOCUMENTS=200/);
    assert.match(dataRuntime, /MAX_AUDIT_EVENTS=300/);
    assert.match(dataRuntime, /schemaVersion!==1/);
    assert.match(dataRuntime, /localStorage\.length/);
    assert.match(dataRuntime, /window\.ProcedureCasePortfolio/);
    assert.doesNotMatch(dataRuntime, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
  });

  it("shows metrics, filters, deterministic sorting, and cards", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");
    const runtime = await readSource("public/procedure-case-portfolio.js");

    assert.match(html, /Total de casos/);
    assert.match(html, /Casos activos/);
    assert.match(html, /Con bloqueos/);
    assert.match(html, /Listos para revisión/);
    assert.match(html, /Completados operativos/);
    assert.match(html, /case-search/);
    assert.match(html, /case-status/);
    assert.match(html, /case-sort/);
    assert.match(runtime, /progressPct/);
    assert.match(runtime, /missing/);
    assert.match(runtime, /lastActivity/);
    assert.match(runtime, /No hay casos locales que coincidan con los filtros/);
  });

  it("keeps metrics operational and exports a versioned snapshot", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");
    const dataRuntime = await readSource("public/procedure-case-portfolio-data.js");
    const runtime = await readSource("public/procedure-case-portfolio.js");

    assert.match(html, /no prueban cumplimiento legal/i);
    assert.match(html, /no dictaminan recepción,\s*liquidación, pago ni cierre/i);
    assert.match(dataRuntime, /portfolioSchemaVersion:1/);
    assert.match(runtime, /case-portfolio-export\.json/);
    assert.match(html, /Exportar portafolio JSON/);
    assert.doesNotMatch(`${dataRuntime}\n${runtime}`, /import.*portfolio/i);
  });

  it("opens a case only through a bounded local key", async () => {
    const opener = await readSource("public/procedure-case-open.js");
    const feedback = await readSource("public/procedure-feedback.js");

    assert.match(opener, /CASE_KEY_PATTERN/);
    assert.match(opener, /startsWith\(STORAGE_PREFIX\)/);
    assert.match(opener, /MAX_RECORD_BYTES = 250000/);
    assert.match(opener, /workflowSnapshot\?\.query/);
    assert.match(opener, /procedure-workflow-form/);
    assert.match(opener, /dispatchEvent\(new Event\("submit"/);
    assert.doesNotMatch(opener, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
    assert.match(feedback, /procedure-case-open\.js/);
    assert.match(feedback, /procedure-case-portfolio\.html/);
  });

  it("includes all portfolio artifacts in Pages verification", async () => {
    const verifier = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(verifier, /procedure-case-portfolio\.html/);
    assert.match(verifier, /procedure-case-portfolio\.css/);
    assert.match(verifier, /procedure-case-portfolio-data\.js/);
    assert.match(verifier, /procedure-case-portfolio\.js/);
    assert.match(verifier, /procedure-case-open\.js/);
    assert.match(verifier, /Case portfolio dashboard/);
  });
});
