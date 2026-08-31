import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWidget = async (): Promise<string> => readFile("public/widget.js", "utf-8");

describe("chat answer quality and evidence composition", () => {
  it("adds synthesis-first composition helpers for retrieval-style content", async () => {
    const widget = await readWidget();
    assert.match(widget, /function isRetrievalDump/);
    assert.match(widget, /function cleanMainAnswer/);
    assert.match(widget, /function detectThemes/);
    assert.match(widget, /function composeAnswerView/);
    assert.match(widget, /Encontr\[eé\]\\s\+\\d\+\\s\+\(referencias\|resultados\)/);
    assert.match(widget, /PDM-OT\.\+p\[aá\]gina/);
  });

  it("renders one plain-language answer hierarchy before evidence", async () => {
    const widget = await readWidget();
    assert.match(widget, /muni-answer-title/);
    assert.match(widget, /muni-answer-summary/);
    assert.match(widget, /Respuesta basada en documentos/);
    assert.match(widget, /Encontré información relacionada, pero no suficiente/);
    assert.match(widget, /No encontré información suficiente/);
    assert.match(widget, /Abre las fuentes para revisar/);
    assert.doesNotMatch(widget, /Respuesta breve|Hallazgos documentales|muni-key-findings|muni-answer-kicker/);
  });

  it("keeps evidence collapsed by default and reveals it on demand", async () => {
    const widget = await readWidget();
    assert.match(widget, /fuente\$\{view\.citations\.length===1\?"":"s"\} encontrada/);
    assert.match(widget, /aria-expanded="false">Ver fuentes/);
    assert.match(widget, /Ocultar fuentes/);
    assert.match(widget, /Ver fuentes/);
    assert.match(widget, /citationsDiv\.className="muni-citations collapsed"/);
    assert.match(widget, /const isCollapsed = citations\.classList\.toggle\("collapsed"\)/);
  });

  it("keeps individual citation expansion and keyboard behavior", async () => {
    const widget = await readWidget();
    assert.match(widget, /muni-citation-excerpt/);
    assert.match(widget, /data-excerpt-full/);
    assert.match(widget, /data-excerpt-preview/);
    assert.match(widget, /card\.classList\.toggle\("expanded"\)/);
    assert.match(widget, /event\.key === "Enter"/);
    assert.match(widget, /event\.key === " "/);
  });

  it("adds at most two follow-up prompts based on detected evidence themes", async () => {
    const widget = await readWidget();
    assert.match(widget, /THEME_RULES/);
    assert.match(widget, /Agua potable y saneamiento/);
    assert.match(widget, /Aguas residuales/);
    assert.match(widget, /Aguas pluviales/);
    assert.match(widget, /Acueducto y abastecimiento/);
    assert.match(widget, /followups\.slice\(0,2\)/);
    assert.match(widget, /muni-followup-chip/);
  });

  it("uses the public gateway contract and keeps advanced search options secondary", async () => {
    const widget = await readWidget();
    assert.match(widget, /\/api\/public\/v1\/query/);
    assert.match(widget, /data-api-path/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
    assert.match(widget, /this\.searchMode\s*=\s*"keyword"/);
    assert.match(widget, /this\.setSearchMode\("phrase"\)/);
    assert.match(widget, /<details class="muni-search-options">/);
    assert.match(widget, /Opciones de búsqueda/);
    assert.match(widget, /Coincidencias de palabras/);
    assert.match(widget, /Frase exacta/);
  });
});
