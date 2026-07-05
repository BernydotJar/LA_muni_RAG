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

  it("renders a short municipal synthesis before evidence", async () => {
    const widget = await readWidget();

    assert.match(widget, /muni-answer-summary/);
    assert.match(widget, /Respuesta breve/);
    assert.match(widget, /Hallazgos principales/);
    assert.match(widget, /muni-key-findings/);
    assert.match(widget, /No la presentaría como una respuesta única cerrada/);
    assert.match(widget, /Te dejo una síntesis primero y las fuentes verificadas aparte/);
  });

  it("shows verified evidence by default while still allowing users to hide it", async () => {
    const widget = await readWidget();

    assert.match(widget, /Fuentes verificadas · \$\{view\.citations\.length\}/);
    assert.match(widget, /aria-expanded="true"/);
    assert.match(widget, /Ocultar evidencia/);
    assert.match(widget, /Ver evidencia/);
    assert.match(widget, /citationsDiv\.className = "muni-citations"/);
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

  it("adds follow-up chips based on detected evidence themes", async () => {
    const widget = await readWidget();

    assert.match(widget, /THEME_RULES/);
    assert.match(widget, /Agua potable y saneamiento/);
    assert.match(widget, /Aguas residuales/);
    assert.match(widget, /Aguas pluviales/);
    assert.match(widget, /Acueducto y abastecimiento/);
    assert.match(widget, /muni-followup-chip/);
    assert.match(widget, /this\.sendQuery\(chip\.getAttribute\("data-query"\)/);
  });

  it("preserves the existing chat API contract and mode controls", async () => {
    const widget = await readWidget();

    assert.match(widget, /\/api\/chat/);
    assert.match(widget, /JSON\.stringify\(\{ message, mode: this\.searchMode, limit: 5 \}\)/);
    assert.match(widget, /this\.searchMode = "keyword"/);
    assert.match(widget, /this\.setSearchMode\("phrase"\)/);
    assert.match(widget, /Palabras clave/);
    assert.match(widget, /Frase exacta/);
  });
});
