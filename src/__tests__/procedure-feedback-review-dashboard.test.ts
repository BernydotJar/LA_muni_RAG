import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("procedure feedback review dashboard", () => {
  it("adds a local dashboard page for reviewing procedure feedback", async () => {
    const html = await readSource("public/procedure-feedback-dashboard.html");

    assert.match(html, /Dashboard de feedback procedimental/);
    assert.match(html, /la-muni-rag:procedure-feedback/);
    assert.match(html, /metric-total/);
    assert.match(html, /metric-workflows/);
    assert.match(html, /metric-docs/);
    assert.match(html, /metric-legal-deadline/);
    assert.match(html, /feedback-list/);
  });

  it("renders filters, feedback cards, copy actions, and clear action", async () => {
    const html = await readSource("public/procedure-feedback-dashboard.html");

    assert.match(html, /feedback-type-filter/);
    assert.match(html, /feedback-search/);
    assert.match(html, /copy-filtered-json/);
    assert.match(html, /copy-all-json/);
    assert.match(html, /clear-feedback/);
    assert.match(html, /feedback-card/);
    assert.match(html, /comment-box/);
    assert.match(html, /external-reference-note/);
    assert.match(html, /Referencia comparativa/);
    assert.match(html, /validar contra normativa\/documentos oficiales de Antigua/);
    assert.match(html, /window\.confirm/);
  });

  it("escapes dynamic feedback content before rendering", async () => {
    const html = await readSource("public/procedure-feedback-dashboard.html");

    assert.match(html, /const escapeHtml = \(value\) =>/);
    assert.match(html, /div\.textContent = String\(value \?\? ""\)/);
    assert.match(html, /escapeHtml\(item\.workflowTitle/);
    assert.match(html, /escapeHtml\(item\.comment/);
    assert.match(html, /escapeHtml\(item\.stepTitle/);
  });

  it("does not send dashboard data over the network", async () => {
    const html = await readSource("public/procedure-feedback-dashboard.html");

    assert.doesNotMatch(html, /fetch\(/);
    assert.doesNotMatch(html, /XMLHttpRequest/);
    assert.doesNotMatch(html, /sendBeacon/);
    assert.doesNotMatch(html, /navigator\.sendBeacon/);
  });

  it("links the dashboard from the procedure feedback panel", async () => {
    const feedbackScript = await readSource("public/procedure-feedback.js");

    assert.match(feedbackScript, /procedure-feedback-dashboard\.html/);
    assert.match(feedbackScript, /Ver dashboard de feedback/);
  });

  it("updates Pages build and verification for the dashboard", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /procedure-feedback-dashboard\.html/);
    assert.match(verifyScript, /procedure-feedback-dashboard\.html/);
    assert.match(verifyScript, /Feedback dashboard is missing the localStorage feedback key/);
  });

  it("documents local-only governance and future backend path", async () => {
    const docs = await readSource("docs/procedure-feedback-review-dashboard.md");

    assert.match(docs, /localStorage/);
    assert.match(docs, /product signal/);
    assert.match(docs, /not municipal evidence/);
    assert.match(docs, /external reference/);
    assert.match(docs, /applicable national legislation/);
    assert.match(docs, /Future backend path/);
  });
});
