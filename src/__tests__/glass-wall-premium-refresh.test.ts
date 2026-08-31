import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");
const visibleText = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("glass wall premium refresh", () => {
  it("keeps a plain-language Spanish technical-view identity", async () => {
    const html = await readGlassWall();

    assert.match(html, /<html lang="es">/);
    assert.match(html, /Cómo se construye una respuesta/);
    assert.match(html, /Vista técnica/);
    assert.match(visibleText(html), /Observa cómo el sistema busca y prepara una respuesta/);
    assert.match(visibleText(html), /método de búsqueda/);
  });

  it("adds lightweight premium homepage alignment", async () => {
    const html = await readGlassWall();

    assert.match(html, /Volver al inicio/);
    assert.match(html, /Vista técnica/);
    assert.match(html, /Qué puedes inspeccionar/);
    assert.doesNotMatch(html, /Sin caja negra/);
    assert.match(html, /glass-orb/);
    assert.match(html, /body::after/);
  });

  it("preserves the safe observable endpoint allowlist", async () => {
    const html = await readGlassWall();

    assert.match(html, /approvedEndpointPaths/);
    assert.match(html, /\/api\/public\/v1\/query/);
    assert.match(html, /method: "POST"/);
    assert.match(html, /JSON\.stringify\(\{ message, mode, limit: 5 \}\)/);
    assert.match(html, /state\.mode === "hybrid" \? \["keyword", "phrase"\]/);
    assert.doesNotMatch(html, /\/api\/evidence/);
    assert.doesNotMatch(html, /\/api\/answer/);
  });

  it("preserves graph and safety contract elements", async () => {
    const html = await readGlassWall();

    assert.match(html, /id="glass-wall-graph"/);
    assert.match(html, /id="glass-wall-form"/);
    assert.match(html, /id="glass-wall-status"/);
    assert.match(html, /node-not-found/);
    assert.match(html, /node-audit/);
    assert.match(html, /No muestra credenciales/);
    assert.match(html, /razonamiento privado/);
  });
});
