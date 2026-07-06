import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWidget = async (): Promise<string> => readFile("public/widget.js", "utf-8");

describe("premium chat widget evidence panel", () => {
  it("keeps the embeddable widget configuration and chat API contract", async () => {
    const widget = await readWidget();
    assert.match(widget, /document\.currentScript/);
    assert.match(widget, /data-api-url/);
    assert.match(widget, /data-position/);
    assert.match(widget, /data-theme/);
    assert.match(widget, /data-title/);
    assert.match(widget, /\/api\/chat/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
    assert.match(widget, /this\.searchMode = "keyword"/);
    assert.match(widget, /this\.setSearchMode\("phrase"\)/);
  });

  it("uses a premium civic evidence-panel visual system", async () => {
    const widget = await readWidget();
    assert.match(widget, /premium civic evidence panel|muni-answer-kicker|Respuesta con evidencia/);
    assert.match(widget, /--muni-cyan/);
    assert.match(widget, /--muni-magenta/);
    assert.match(widget, /--muni-surface-strong/);
    assert.match(widget, /muni-header-rail/);
    assert.match(widget, /muni-rail-pill/);
    assert.match(widget, /muni-answer-kicker/);
    assert.match(widget, /muni-citation-index/);
    assert.match(widget, /Consultando evidencia/);
  });

  it("renders citations as premium expandable evidence dossiers", async () => {
    const widget = await readWidget();
    assert.match(widget, /muni-citations/);
    assert.match(widget, /muni-citation-header/);
    assert.match(widget, /muni-citation-badge/);
    assert.match(widget, /Evidencia \$\{index \+ 1\}/);
    assert.match(widget, /data-excerpt-full/);
    assert.match(widget, /data-excerpt-preview/);
    assert.match(widget, /card\.classList\.toggle\("expanded"\)/);
    assert.match(widget, /card\.addEventListener\("keydown"/);
  });

  it("removes external font dependency and keeps shadow-dom isolation", async () => {
    const widget = await readWidget();
    assert.doesNotMatch(widget, /@import url/);
    assert.match(widget, /attachShadow\(\{ mode: "open" \}\)/);
    assert.match(widget, /all:\s*initial/);
    assert.match(widget, /font-family:\s*var\(--muni-font\)/);
  });

  it("keeps premium mobile and reduced-motion guardrails", async () => {
    const widget = await readWidget();
    assert.match(widget, /max-width: 480px/);
    assert.match(widget, /100dvh - 96px/);
    assert.match(widget, /prefers-reduced-motion/);
    assert.match(widget, /animation: none !important/);
    assert.match(widget, /transition-duration: 0\.01ms !important/);
  });

  it("keeps Spanish municipal copy and official evidence positioning", async () => {
    const widget = await readWidget();
    assert.match(widget, /Asistente Municipal/);
    assert.match(widget, /Documentos municipales verificados/);
    assert.match(widget, /Consulta municipal con evidencia/);
    assert.match(widget, /Evidencia de documentos municipales oficiales/);
    assert.match(widget, /Escribe tu consulta municipal/);
  });
});
