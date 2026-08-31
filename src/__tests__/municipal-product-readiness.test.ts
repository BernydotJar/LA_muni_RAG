import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWidget = async (): Promise<string> => readFile("public/widget.js", "utf-8");

describe("municipal product readiness and evidence copy", () => {
  it("keeps useful prompts only when a real API is configured", async () => {
    const widget = await readWidget();
    assert.match(widget, /const explicitApiUrl/);
    assert.match(widget, /explicitApiUrl\.length > 0/);
    assert.match(widget, /¿Qué dice el PDM-OT sobre agua\?/);
    assert.match(widget, /¿Qué prioridades municipales aparecen en los documentos\?/);
    assert.match(widget, /Falta conectar el servicio de búsqueda/);
    assert.match(widget, /configura una dirección HTTPS/);
    assert.doesNotMatch(widget, /Modo demo municipal/);
  });

  it("uses conservative plain-language source copy", async () => {
    const widget = await readWidget();
    assert.match(widget, /Respuesta basada en documentos/);
    assert.match(widget, /No encontré información suficiente/);
    assert.match(widget, /Ver fuentes/);
    assert.match(widget, /Ábrelas para revisar documento, página y fragmento/);
    assert.match(widget, /Por qué se muestra/);
    assert.doesNotMatch(widget, /Respuesta breve|Hallazgos documentales|Consulta trazable|Evidencia disponible/);
    assert.doesNotMatch(widget, /documentos municipales oficiales cargados en el corpus/);
  });

  it("fails closed and disables controls when an embed has no configured API", async () => {
    const widget = await readWidget();
    assert.match(widget, /data-api-configured/);
    assert.match(widget, /Consulta no disponible/);
    assert.match(widget, /Configura el servicio para consultar/);
    assert.match(widget, /if\(!apiConfigured\)/);
    assert.match(widget, /const disabled=apiConfigured\?"":" disabled"/);
  });

  it("uses human-readable document-support labels instead of raw confidence copy", async () => {
    const widget = await readWidget();
    assert.match(widget, /function institutionalConfidenceLabel/);
    assert.match(widget, /Respaldo documental alto/);
    assert.match(widget, /Respaldo documental medio/);
    assert.match(widget, /Respaldo documental limitado/);
    assert.match(widget, /Sin fuentes encontradas/);
    assert.doesNotMatch(widget, /Confianza Baja|Confianza baja|Evidencia sólida|Evidencia suficiente|Evidencia limitada/);
  });

  it("cleans excerpts and preserves source metadata and relevance", async () => {
    const widget = await readWidget();
    assert.match(widget, /function cleanVisibleText/);
    assert.match(widget, /muni-source-meta-grid/);
    assert.match(widget, /Documento/);
    assert.match(widget, /Página/);
    assert.match(widget, /function relevanceReason/);
    assert.match(widget, /Abrir documento/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
  });
});
