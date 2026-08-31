import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string) => readFile(path, "utf8");

describe("public plain-language and low-density UX v1", () => {
  it("states the public task and evidence benefit without unexplained metaphors", async () => {
    const html = await read("public/index.html");
    assert.match(html, /Pregunta sobre documentos municipales/);
    assert.match(html, /Revisa las fuentes/);
    assert.match(html, /Si no hay información suficiente, el sistema te lo indica/);
    assert.doesNotMatch(html, /Sin caja negra|Glass Wall|Antigua-first|Read-only|pack-aware/i);
  });

  it("uses progressive disclosure and removes redundant chat chrome", async () => {
    const widget = await read("public/widget.js");
    assert.match(widget, /muni-citations collapsed/);
    assert.match(widget, /aria-expanded="false">Ver fuentes/);
    assert.match(widget, /<details class="muni-search-options">/);
    assert.match(widget, /followups\.slice\(0,2\)/);
    assert.doesNotMatch(widget, /muni-header-rail|muni-rail-pill|muni-trace-seal|muni-key-findings|muni-answer-kicker/);
  });

  it("hardens the shadow-dom layout against horizontal overflow", async () => {
    const widget = await read("public/widget.js");
    assert.match(widget, /box-sizing:\s*border-box;\s*min-width:\s*0/);
    assert.match(widget, /grid-template-columns:minmax\(0,1fr\) auto/);
    assert.match(widget, /overflow-y:auto; overflow-x:hidden/);
    assert.match(widget, /position:fixed;left:10px;right:10px;width:auto;max-width:none/);
    assert.match(widget, /100dvh - 86px/);
  });

  it("keeps technical terminology secondary and explains it where retained", async () => {
    const glassWall = await read("public/glass-wall.html");
    const workflow = await read("public/procedure-workflow.html");
    const intake = await read("public/domain-intake.html");
    assert.match(glassWall, /Método de búsqueda/);
    assert.match(glassWall, /coincidencias de palabras/);
    assert.match(glassWall, /Búsqueda vectorial/);
    assert.match(glassWall, /detalle interno no expuesto/);
    assert.match(workflow, /Primero, Antigua Guatemala/);
    assert.match(workflow, /Método de búsqueda/);
    assert.match(intake, /Preparación de documentos/);
    assert.doesNotMatch(`${glassWall}\n${workflow}\n${intake}`, /Sin caja negra|Antigua-first|Intake documental|pack-aware/i);
  });
});
