import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWidget = async (): Promise<string> => readFile("public/widget.js", "utf-8");

describe("municipal product readiness and evidence copy", () => {
  it("keeps useful prompts only when a real API is configured", async () => {
    const widget = await readWidget();
    assert.match(widget, /const explicitApiUrl/);
    assert.match(widget, /explicitApiUrl\.length > 0/);
    assert.match(widget, /¿Cuáles son las necesidades más urgentes\?/);
    assert.match(widget, /¿Qué dice el PDM-OT sobre agua\?/);
    assert.match(widget, /¿Qué prioridades municipales aparecen en el documento\?/);
    assert.match(widget, /El asistente necesita un backend real/);
    assert.match(widget, /Configura un endpoint HTTPS/);
    assert.doesNotMatch(widget, /Modo demo municipal/);
  });

  it("uses conservative evidence copy without claiming an official loaded corpus", async () => {
    const widget = await readWidget();
    assert.match(widget, /Respuesta breve/);
    assert.match(widget, /Hallazgos principales/);
    assert.match(widget, /Evidencia disponible/);
    assert.match(widget, /Consulta trazable/);
    assert.match(widget, /Revisa las citas, la vigencia y la aplicabilidad/);
    assert.doesNotMatch(widget, /documentos municipales oficiales cargados en el corpus/);
    assert.doesNotMatch(widget, /Documentos municipales verificados/);
  });

  it("fails closed and disables controls when Pages has no backend", async () => {
    const widget = await readWidget();
    assert.match(widget, /data-api-configured/);
    assert.match(widget, /Servicio no configurado/);
    assert.match(widget, /Consulta deshabilitada hasta configurar la API/);
    assert.match(widget, /if\(!apiConfigured\)/);
    assert.match(widget, /const disabled=apiConfigured\?"":" disabled"/);
  });

  it("uses institutional evidence-status labels instead of raw confidence copy", async () => {
    const widget = await readWidget();
    assert.match(widget, /function institutionalConfidenceLabel/);
    assert.match(widget, /Evidencia sólida/);
    assert.match(widget, /Evidencia suficiente/);
    assert.match(widget, /Evidencia limitada/);
    assert.doesNotMatch(widget, /Confianza Baja|Confianza baja/);
  });

  it("cleans excerpts and preserves source metadata and relevance", async () => {
    const widget = await readWidget();
    assert.match(widget, /function cleanVisibleText/);
    assert.match(widget, /muni-source-meta-grid/);
    assert.match(widget, /Documento/);
    assert.match(widget, /Página/);
    assert.match(widget, /Evidencia textual/);
    assert.match(widget, /function relevanceReason/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
  });
});
