import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("premium RAG frontend refresh", () => {
  it("keeps the evidence-first municipal RAG narrative in Spanish", async () => {
    const html = await readHomepage();

    assert.match(html, /lang="es"/);
    assert.match(html, /RAG municipal con evidencia verificable/);
    assert.match(html, /Consulta pública/);
    assert.match(html, /Sin caja negra/);
    assert.match(html, /Si no existe evidencia suficiente, el sistema debe decirlo/);
    assert.match(html, /sin hallazgos/i);
  });

  it("ships the cinematic scroll story section", async () => {
    const html = await readHomepage();

    assert.match(html, /id="scroll-story"/);
    assert.match(html, /cinematic-strip/);
    assert.match(html, /cinematic-stage/);
    assert.match(html, /stage-core/);
    assert.match(html, /story-card/);
  });

  it("keeps core product CTAs and embed behavior", async () => {
    const html = await readHomepage();

    assert.match(html, /id="open-chat-btn"/);
    assert.match(html, /id="open-chat-btn-cta"/);
    assert.match(html, /id="widget-url"/);
    assert.match(html, /\/widget\.js/);
    assert.match(html, /copy-btn/);
  });

  it("keeps the RAG Glass Wall entry point with Spanish technical copy", async () => {
    const html = await readHomepage();

    assert.match(html, /glass-wall\.html/);
    assert.match(html, /Glass Wall/);
    assert.match(html, /sala técnica/i);
    assert.match(html, /ruta de consulta, evidencia y salida segura/i);
  });

  it("adds scroll-driven motion while respecting reduced motion", async () => {
    const html = await readHomepage();

    assert.match(html, /--scroll/);
    assert.match(html, /updateScrollProgress/);
    assert.match(html, /prefers-reduced-motion/);
  });

  it("aligns the Glass Wall technical room with the Spanish premium frontend", async () => {
    const html = await readGlassWall();

    assert.match(html, /lang="es"/);
    assert.match(html, /Volver al inicio/);
    assert.match(html, /Sala técnica/);
    assert.match(html, /Sin caja negra/);
    assert.match(html, /prefers-reduced-motion/);
  });

  it("keeps Glass Wall safe endpoints and Spanish safety copy", async () => {
    const html = await readGlassWall();

    assert.match(html, /approvedEndpointPaths = \["\/health", "\/api\/evidence", "\/api\/answer"\]/);
    assert.match(html, /Contrato de seguridad/);
    assert.match(html, /No muestra prompts, credenciales/);
    assert.match(html, /URLs de base de datos/);
    assert.match(html, /razonamiento oculto/);
  });
});
