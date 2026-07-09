import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("glass wall premium refresh", () => {
  it("keeps the Spanish Glass Wall identity", async () => {
    const html = await readGlassWall();

    assert.match(html, /<html lang="es">/);
    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /Vista técnica/);
    assert.match(html, /Sala de observación para recuperación documental/);
    assert.match(html, /recuperación documental/);
  });

  it("adds lightweight premium homepage alignment", async () => {
    const html = await readGlassWall();

    assert.match(html, /Volver al inicio/);
    assert.match(html, /Sala técnica/);
    assert.match(html, /Sin caja negra/);
    assert.match(html, /glass-orb/);
    assert.match(html, /body::after/);
  });

  it("preserves the safe observable endpoint allowlist", async () => {
    const html = await readGlassWall();

    assert.match(html, /approvedEndpointPaths/);
    assert.match(html, /\/health/);
    assert.match(html, /\/api\/evidence/);
    assert.match(html, /\/api\/answer/);
    assert.match(html, /Endpoint no aprobado para (renderizado )?Glass Wall/);
  });

  it("preserves graph and safety contract elements", async () => {
    const html = await readGlassWall();

    assert.match(html, /id="glass-wall-graph"/);
    assert.match(html, /id="glass-wall-form"/);
    assert.match(html, /id="glass-wall-status"/);
    assert.match(html, /node-not-found/);
    assert.match(html, /node-audit/);
    assert.match(html, /No muestra prompts, credenciales/);
    assert.match(html, /razonamiento oculto/);
  });
});
