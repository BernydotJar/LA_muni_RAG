import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const glassWallPath = join(process.cwd(), "public", "glass-wall.html");
const homePath = join(process.cwd(), "public", "index.html");

const readGlassWall = async (): Promise<string> => Promise.all([glassWallPath, "public/glass-wall.css", "public/glass-wall-view.js", "public/glass-wall-flow.js"].map((path) => readFile(path, "utf-8"))).then((parts) => parts.join("\n"));
const readHome = async (): Promise<string> => readFile(homePath, "utf-8");

describe("RAG glass wall static page", () => {
  it("contains stable DOM anchors for the operator view", async () => {
    const html = await readGlassWall();

    assert.match(html, /id="glass-wall-form"/);
    assert.match(html, /id="glass-wall-query"/);
    assert.match(html, /id="glass-wall-mode"/);
    assert.match(html, /id="glass-wall-graph"/);
    assert.match(html, /id="glass-wall-results"/);
    assert.match(html, /id="glass-wall-runtime"/);
    assert.match(html, /id="glass-wall-safety"/);
    assert.match(html, /id="glass-wall-legend"/);
    assert.match(html, /id="glass-wall-legend-panel"/);
  });

  it("contains expanded graph nodes for the Spanish Glass Wall", async () => {
    const html = await readGlassWall();
    const expectedNodes = ["node-query", "node-mode", "node-limit", "node-safety", "node-phrase", "node-keyword", "node-merge", "node-citation", "node-score", "node-answer", "node-not-found", "node-audit", "node-vector", "node-embedding", "node-db"];

    for (const nodeId of expectedNodes) {
      assert.match(html, new RegExp(`id="${nodeId}"`));
    }
  });

  it("keeps nodes in a responsive grid and arrows measured at real node boundaries", async () => {
    const html = await readGlassWall();
    assert.match(html, /flow-stages/);
    assert.match(html, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
    assert.match(html, /ResizeObserver/);
    assert.match(html, /getBoundingClientRect/);
    assert.match(html, /marker-end/);
    assert.doesNotMatch(html, /board\.style\.transform|scale\(/);
  });

  it("is intentionally discoverable from the homepage", async () => {
    const html = await readHome();

    assert.match(html, /href="\.\/glass-wall\.html">Cómo funciona/);
    assert.match(html, /data-open-assistant>Asistente/);
    assert.match(html, /Ver cómo funciona/);
  });

  it("references only approved application endpoints", async () => {
    const html = await readGlassWall();
    const endpointMatches = [...html.matchAll(/["'`]\/(?:api\/[a-z]+|health)[^"'`]*/g)].map((match) =>
      match[0].slice(1)
    );
    const uniqueEndpoints = [...new Set(endpointMatches)];

    assert.ok(uniqueEndpoints.length > 0);
    assert.deepEqual(
      uniqueEndpoints,
      ["/api/public/v1/query"]
    );
    assert.doesNotMatch(html, /\/api\/evidence/);
    assert.doesNotMatch(html, /\/api\/answer/);
  });

  it("does not include obvious secret or hidden-reasoning markers", async () => {
    const html = await readGlassWall();
    const forbiddenPatterns = [
      /DATABASE_URL\s*=/i,
      /OPENAI_API_KEY\s*=/i,
      /ANTHROPIC_API_KEY\s*=/i,
      /GOOGLE_API_KEY\s*=/i,
      /password\s*=/i,
      /secret\s*=/i,
      /chain[- ]of[- ]thought\s*:/i,
      /system prompt\s*:/i,
    ];

    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(html, pattern);
    }
  });

  it("declares the safe glass-wall contract and visible legend in Spanish", async () => {
    const html = await readGlassWall();

    assert.match(html, /Cómo funciona · vista técnica/);
    assert.match(html, /datos de diagnóstico autorizados/);
    assert.match(html, /salud general del servicio/);
    assert.match(html, /Completada/);
    assert.match(html, /Con l.mites/);
    assert.match(html, /No ejecutada/);
  });
});
