import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWidget = async (): Promise<string> => readFile("public/widget.js", "utf-8");

describe("premium chat widget evidence panel", () => {
  it("keeps the embeddable widget configuration and public query contract", async () => {
    const widget = await readWidget();
    assert.match(widget, /document\.currentScript/);
    assert.match(widget, /data-api-url/);
    assert.match(widget, /data-api-path/);
    assert.match(widget, /\/api\/public\/v1\/query/);
    assert.match(widget, /data-position/);
    assert.match(widget, /data-theme/);
    assert.match(widget, /data-title/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
  });

  it("uses a restrained heritage-burgundy paper visual system", async () => {
    const widget = await readWidget();
    assert.match(widget, /--muni-primary: #731729/);
    assert.match(widget, /--muni-accent: #8b2a42/);
    assert.match(widget, /--muni-surface: rgba\(255, 253, 249, 0\.96\)/);
    assert.match(widget, /--muni-surface-strong: #fffdf9/);
    assert.doesNotMatch(widget, /#22d3ee|#8b5cf6|#7c5cff|#6d5df6/i);
    assert.doesNotMatch(widget, /muni-header-rail|muni-rail-pill|muni-answer-kicker|muni-trace-seal/);
    assert.match(widget, /muni-citation-index/);
    assert.match(widget, /Buscando en documentos/);
    assert.match(widget, /muni-bubble:focus-visible/);
    assert.match(widget, /--muni-focus/);
  });

  it("renders citations as expandable source cards hidden until requested", async () => {
    const widget = await readWidget();
    assert.match(widget, /muni-citations collapsed/);
    assert.match(widget, /muni-citation-header/);
    assert.match(widget, /muni-citation-badge/);
    assert.match(widget, /Fuente \$\{index\+1\}/);
    assert.match(widget, /data-excerpt-full/);
    assert.match(widget, /data-excerpt-preview/);
    assert.match(widget, /card\.classList\.toggle\("expanded"\)/);
    assert.match(widget, /card\.addEventListener\("keydown"/);
    assert.match(widget, /Ver fuentes/);
  });

  it("removes external font dependency and keeps shadow-dom isolation", async () => {
    const widget = await readWidget();
    assert.doesNotMatch(widget, /@import url/);
    assert.match(widget, /attachShadow\(\{ mode: "open" \}\)/);
    assert.match(widget, /all:\s*initial/);
    assert.match(widget, /font-family:\s*var\(--muni-font\)/);
  });

  it("keeps mobile, overflow and accessibility guardrails", async () => {
    const widget = await readWidget();
    assert.match(widget, /max-width:480px/);
    assert.match(widget, /100dvh - 86px/);
    assert.match(widget, /box-sizing:\s*border-box;\s*min-width:\s*0/);
    assert.match(widget, /overflow-y:auto; overflow-x:hidden/);
    assert.match(widget, /prefers-reduced-motion/);
    assert.match(widget, /prefers-reduced-transparency/);
    assert.match(widget, /forced-colors/);
    assert.match(widget, /min-height:44px/);
  });

  it("uses natural Spanish copy and honest service positioning", async () => {
    const widget = await readWidget();
    assert.match(widget, /Asistente de documentos municipales/);
    assert.match(widget, /Listo para buscar en documentos/);
    assert.match(widget, /Consulta no disponible/);
    assert.match(widget, /Pregunta y revisa la fuente/);
    assert.match(widget, /Falta conectar el servicio de búsqueda/);
    assert.match(widget, /Pregunta sobre un tema municipal/);
    assert.match(widget, /role="dialog"/);
    assert.match(widget, /role="log" aria-live="polite"/);
    assert.match(widget, /aria-expanded="false" aria-controls="muni-window"/);
    assert.match(widget, /aria-pressed="true"/);
    assert.match(widget, /e\.key==="Escape"/);
    assert.doesNotMatch(widget, /Modo demo municipal|Documentos municipales verificados|Consulta municipal con evidencia|Consulta documental con trazabilidad/);
  });
});
