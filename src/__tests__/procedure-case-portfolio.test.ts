import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("local procedure case portfolio", () => {
  it("adds a dedicated Spanish local portfolio page", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");

    assert.match(html, /Portafolio local de casos/);
    assert.match(html, /Señales operativas, no dictamen institucional/);
    assert.match(html, /Volver a flujos/);
    assert.match(html, /case-list/);
    assert.match(html, /metric-grid/);
  });

  it("reads only bounded namespaced LocalStorage records", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");

    assert.match(html, /la-muni-rag:procedure-case:/);
    assert.match(html, /MAX_CASES = 200/);
    assert.match(html, /MAX_STEPS = 100/);
    assert.match(html, /MAX_DOCUMENTS = 200/);
    assert.match(html, /MAX_AUDIT_EVENTS = 300/);
    assert.match(html, /schemaVersion !== 1/);
    assert.match(html, /localStorage\.length/);
    assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket|sendBeacon/);
  });

  it("shows operational metrics, filters, deterministic sorting, and cards", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");

    assert.match(html, /Total de casos/);
    assert.match(html, /Casos activos/);
    assert.match(html, /Con bloqueos/);
    assert.match(html, /Listos para revisión/);
    assert.match(html, /Completados operativos/);
    assert.match(html, /case-search/);
    assert.match(html, /case-status/);
    assert.match(html, /case-sort/);
    assert.match(html, /progressPct/);
    assert.match(html, /missingDocuments/);
    assert.match(html, /lastActivity/);
  });

  it("keeps portfolio metrics operational and exports a versioned bounded snapshot", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");

    assert.match(html, /no prueban cumplimiento legal/i);
    assert.match(html, /no dictaminan recepción, liquidación, pago ni cierre/i);
    assert.match(html, /portfolioSchemaVersion: 1/);
    assert.match(html, /case-portfolio-export\.json/);
    assert.match(html, /Exportar portafolio JSON/);
    assert.doesNotMatch(html, /import.*portfolio/i);
  });

  it("opens a case only through a bounded local key and restores its query", async () => {
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

  it("includes the portfolio and opener in the Pages artifact contract", async () => {
    const verifier = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(verifier, /procedure-case-portfolio\.html/);
    assert.match(verifier, /procedure-case-open\.js/);
    assert.match(verifier, /Case portfolio dashboard/);
    assert.match(verifier, /Procedure case opener/);
  });
});
