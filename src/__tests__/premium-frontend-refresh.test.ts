import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readProductCss = async (): Promise<string> => readFile("public/product.css", "utf-8");
const readProductJs = async (): Promise<string> => readFile("public/product.js", "utf-8");
const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("production-facing public product surface", () => {
  it("keeps concise evidence-first municipal copy in Spanish", async () => {
    const html = await readHomepage();
    assert.match(html, /lang="es"/);
    assert.match(html, /Consulta pública/);
    assert.match(html, /Sin caja negra/);
    assert.match(html, /Cuando no exista evidencia suficiente, el sistema debe decirlo/);
    assert.match(html, /La publicación estática no fabrica respuestas/);
  });

  it("removes demo-story and marketing-explainer sections from the product", async () => {
    const html = await readHomepage();
    assert.doesNotMatch(html, /id="scroll-story"|cinematic-strip|story-card/);
    assert.doesNotMatch(html, /Experiencia con evidencia|El frontend explica por qué confiar/);
    assert.doesNotMatch(html, /Flujo visual|Del documento municipal a una respuesta auditable/);
    assert.doesNotMatch(html, /Sistema operable|Construido para operar, no solo para verse bien/);
  });

  it("exposes Assistant and Glass Wall directly in the primary menu", async () => {
    const html = await readHomepage();
    assert.match(html, /class="nav-action"[^>]*data-open-assistant>Asistente/);
    assert.match(html, /href="\.\/glass-wall\.html">Glass Wall/);
    assert.match(html, /href="\.\/procedure-training\.html">Academia/);
    assert.match(html, /href="#instalar">Instalar/);
  });

  it("keeps the primary product actions and explicit backend installation", async () => {
    const html = await readHomepage();
    const js = await readProductJs();
    assert.match(html, /id="open-chat-btn"/);
    assert.match(html, /Abrir Glass Wall/);
    assert.match(html, /data-api-url="https:\/\/api\.tu-dominio\.gt"/);
    assert.match(html, /id="widget-url"/);
    assert.match(js, /\[data-open-assistant\]/);
    assert.match(js, /navigator\.clipboard\.writeText/);
  });

  it("uses modular assets and accessibility-focused interaction tokens", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(html, /href="\.\/product\.css"/);
    assert.match(html, /src="\.\/product\.js"/);
    assert.match(html, /class="skip-link"/);
    assert.match(css, /--action:#67e8f9/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /background:rgba\(6,9,22,\.94\)/);
    assert.match(css, /prefers-reduced-motion/);
  });

  it("keeps the Glass Wall technical room safe and available", async () => {
    const html = await readGlassWall();
    assert.match(html, /lang="es"/);
    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /Sala técnica/);
    assert.match(html, /Sin caja negra/);
    assert.match(html, /approvedEndpointPaths/);
    assert.match(html, /prefers-reduced-motion/);
  });
});
