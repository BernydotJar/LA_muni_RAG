import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

const forbiddenPublicInternals = [
  /harness/i,
  /eval harness/i,
  /golden cases/i,
  /casos dorados/i,
  /offline eval/i,
  /offline tests/i,
  /SHIP demo/i,
  /modo CTO/i,
  /CTO mode/i,
  /Technical room/i,
  /Back to LA Muni RAG/i,
  /No black box/i,
];

describe("frontend localization and graph polish", () => {
  it("localizes the public homepage and Glass Wall shells to Spanish", async () => {
    const homepage = await readHomepage();
    const glassWall = await readGlassWall();

    assert.match(homepage, /<html lang="es">/);
    assert.match(glassWall, /<html lang="es">/);
    assert.match(homepage, /Asistente documental para la Municipalidad de La Antigua Guatemala/);
    assert.match(glassWall, /Sala de observación para/);
    assert.match(glassWall, /recuperación documental/);
  });

  it("removes public implementation-internal copy from static frontend files", async () => {
    const homepage = await readHomepage();
    const glassWall = await readGlassWall();

    for (const pattern of forbiddenPublicInternals) {
      assert.doesNotMatch(homepage, pattern);
      assert.doesNotMatch(glassWall, pattern);
    }
  });

  it("adds an Antigua-inspired institutional architecture identity", async () => {
    const homepage = await readHomepage();
    const glassWall = await readGlassWall();

    assert.match(homepage, /architectural-line/);
    assert.match(homepage, /arcos coloniales/);
    assert.match(homepage, /campanario/);
    assert.match(homepage, /cúpula/);
    assert.match(glassWall, /heritage-mark/);
    assert.match(glassWall, /arcos coloniales de Antigua Guatemala/);
  });

  it("uses plaque and panel graph language rather than generic circular nodes", async () => {
    const homepage = await readHomepage();
    const glassWall = await readGlassWall();

    assert.match(homepage, /panel-node/);
    assert.match(glassWall, /grid-template-areas: "dot label" "dot value"/);
    assert.match(glassWall, /node-label/);
    assert.match(glassWall, /node-value/);
    assert.doesNotMatch(glassWall, /\.node \{ position: absolute; width: 128px; transform: translate\(-50%, -50%\); display: grid; justify-items: center/);
  });

  it("preserves widget, Glass Wall route, endpoint allowlist, safety contract, and reduced motion", async () => {
    const homepage = await readHomepage();
    const glassWall = await readGlassWall();

    assert.match(homepage, /<script src="\/widget\.js"><\/script>/);
    assert.match(homepage, /window\.location\.origin \+ '\/widget\.js'/);
    assert.match(homepage, /href="\/glass-wall\.html"/);
    assert.match(glassWall, /approvedEndpointPaths = \["\/health", "\/api\/evidence", "\/api\/answer"\]/);
    assert.match(glassWall, /Contrato de seguridad/);
    assert.match(homepage, /prefers-reduced-motion/);
    assert.match(glassWall, /prefers-reduced-motion/);
  });
});
