import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWidget = async (): Promise<string> => readFile("public/widget.js", "utf-8");

describe("municipal demo readiness and evidence copy polish", () => {
  it("adds stable municipal demo prompts", async () => {
    const widget = await readWidget();

    assert.match(widget, /Modo demo municipal/);
    assert.match(widget, /¿Cuáles son las necesidades más urgentes\?/);
    assert.match(widget, /¿Qué dice el PDM-OT sobre agua\?/);
    assert.match(widget, /¿Qué prioridades municipales aparecen en el documento\?/);
  });

  it("uses institutional answer sections for municipal presentation", async () => {
    const widget = await readWidget();

    assert.match(widget, /Respuesta breve/);
    assert.match(widget, /Hallazgos principales/);
    assert.match(widget, /Fuentes verificadas/);
    assert.match(widget, /Consulta trazable/);
    assert.match(widget, /documentos municipales oficiales cargados en el corpus/);
  });

  it("uses institutional evidence-status labels instead of raw confidence copy", async () => {
    const widget = await readWidget();

    assert.match(widget, /function institutionalConfidenceLabel/);
    assert.match(widget, /Evidencia sólida/);
    assert.match(widget, /Evidencia suficiente/);
    assert.match(widget, /Evidencia limitada/);
    assert.doesNotMatch(widget, /Confianza Baja/);
    assert.doesNotMatch(widget, /Confianza baja/);
  });

  it("cleans visible excerpts and adds source metadata", async () => {
    const widget = await readWidget();

    assert.match(widget, /function cleanVisibleText/);
    assert.match(widget, /muni-source-meta-grid/);
    assert.match(widget, /Documento/);
    assert.match(widget, /Página/);
    assert.match(widget, /Tipo/);
    assert.match(widget, /Uso/);
    assert.match(widget, /Evidencia textual/);
  });

  it("adds source relevance reasons without changing backend contract", async () => {
    const widget = await readWidget();

    assert.match(widget, /function relevanceReason/);
    assert.match(widget, /Relevancia: aporta evidencia textual/);
    assert.match(widget, /Relevancia: aporta un fragmento verificable/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
  });
});
