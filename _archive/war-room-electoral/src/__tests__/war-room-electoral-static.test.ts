import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readWarRoom = async (): Promise<string> => readFile("public/war-room-electoral.html", "utf-8");

describe("electoral war room static surface", () => {
  it("ships a campaign workflow surface with advisor, agents, assets, and handoffs", async () => {
    const html = await readWarRoom();

    assert.match(html, /StratOS Electoral/);
    assert.match(html, /id="jefe-campana"/);
    assert.match(html, /id="station-grid"/);
    assert.match(html, /id="agent-bus"/);
    assert.match(html, /id="biblioteca"/);
    assert.match(html, /Jefe de Campa(?:ñ|n)a/);
    assert.match(html, /Agente de Investigacion/);
    assert.match(html, /Agente Territorial/);
    assert.match(html, /Agente de Contenido/);
    assert.match(html, /Agente de Seguimiento/);
  });

  it("connects the campaign system to existing RAG, territory, and public surfaces", async () => {
    const html = await readWarRoom();

    assert.match(html, /procedure-workflow\.html/);
    assert.match(html, /glass-wall\.html/);
    assert.match(html, /https:\/\/eduardosacahui\.com\/territorio_electoral/);
    assert.match(html, /https:\/\/eduardosacahui\.com\//);
    assert.match(html, /https:\/\/github\.com\/BernydotJar\/LA_muni_RAG/);
  });

  it("uses the provided visual references as campaign assets", async () => {
    const html = await readWarRoom();

    assert.match(html, /war-room-reference-content-flow\.png/);
    assert.match(html, /war-room-reference-channel-map\.png/);
    assert.match(html, /war-room-reference-content-sources\.png/);
    assert.match(html, /war-room-reference-before-after\.png/);
    assert.match(html, /war-room-reference-modules\.png/);
    assert.match(html, /war-room-reference-templates\.png/);
    assert.match(html, /war-room-reference-syllabus\.png/);
  });
});
