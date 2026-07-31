import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("public procedure premium design system", () => {
  it("loads a modular premium stylesheet and semantic command surface", async () => {
    const [html, css] = await Promise.all([
      read("public/procedure-workflow.html"),
      read("public/procedure-workflow-premium.css"),
    ]);
    assert.match(html, /href="\.\/procedure-workflow-premium\.css"/);
    assert.match(html, /class="procedure-command"/);
    assert.match(html, /procedure-command-title/);
    assert.match(html, /class="procedure-field"/);
    assert.match(html, /procedure-runtime-status/);
    assert.match(css, /--procedure-action: #67e8f9/);
    assert.match(css, /--procedure-radius-lg: 28px/);
    assert.match(css, /procedure-surface-raised/);
  });

  it("provides idle, loading, success and error states without raw HTTP messages", async () => {
    const html = await read("public/procedure-workflow.html");
    assert.match(html, /setRuntimeState\("loading"/);
    assert.match(html, /setRuntimeState\("success"/);
    assert.match(html, /setRuntimeState\("error"/);
    assert.match(html, /procedure-loading-shell/);
    assert.match(html, /publicErrorMessage/);
    assert.doesNotMatch(html, /throw new Error\(`HTTP \$\{response\.status\}`\)/);
  });

  it("renders executive metrics and safe official-source links", async () => {
    const html = await read("public/procedure-workflow.html");
    assert.match(html, /workflow-overview/);
    assert.match(html, /workflow-metric/);
    assert.match(html, /safeSourceUrl/);
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    assert.match(html, /url\.protocol === "https:"/);
  });

  it("supports mobile reflow, forced colors, reduced motion and visible focus", async () => {
    const css = await read("public/procedure-workflow-premium.css");
    assert.match(css, /@media \(max-width: 680px\)/);
    assert.match(css, /@media \(forced-colors: active\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /input:focus/);
    assert.match(css, /procedure-skip-link:focus/);
  });
  it("makes the public procurement legal boundary visible without claiming corpus coverage", async () => {
    const html = await read("public/procedure-workflow.html");
    assert.match(html, /id="legal-framework-title"/);
    assert.match(html, /Ley de Contrataciones del Estado/);
    assert.match(html, /Decreto 57-92/);
    assert.match(html, /congreso\.gob\.gt\/buscador_decretos\/ley_de_contrataciones_del_estado/);
    assert.match(html, /todavía debe incorporarse al corpus gobernado/);
    assert.match(html, /no presume vigencia, modalidad, monto ni plazo/i);
  });

});
