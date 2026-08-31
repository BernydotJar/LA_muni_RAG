import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readProductCss = async (): Promise<string> => readFile("public/product.css", "utf-8");
const readLiquidGlassCss = async (): Promise<string> => readFile("public/liquid-glass.css", "utf-8");
const readProductJs = async (): Promise<string> => readFile("public/product.js", "utf-8");
const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("production-facing public product surface", () => {
  it("keeps concise evidence-first municipal copy in Spanish", async () => {
    const html = await readHomepage();
    assert.match(html, /lang="es"/);
    assert.match(html, /Pregunta sobre documentos municipales/);
    assert.match(html, /Revisa las fuentes/);
    assert.doesNotMatch(html, /Sin caja negra/);
    assert.match(html, /Si no hay información suficiente, el sistema te lo indica/);
    assert.match(html, /no completa el vacío con información inventada/);
  });

  it("removes demo-story and marketing-explainer sections from the product", async () => {
    const html = await readHomepage();
    assert.doesNotMatch(html, /id="scroll-story"|cinematic-strip|story-card/);
    assert.doesNotMatch(html, /Experiencia con evidencia|El frontend explica por qué confiar/);
    assert.doesNotMatch(html, /Flujo visual|Del documento municipal a una respuesta auditable/);
    assert.doesNotMatch(html, /Sistema operable|Construido para operar, no solo para verse bien/);
  });

  it("exposes the assistant and a clearly named technical view in the primary menu", async () => {
    const html = await readHomepage();
    assert.match(html, /class="nav-action"[^>]*data-open-assistant>Asistente/);
    assert.match(html, /href="\.\/glass-wall\.html">Cómo funciona/);
    assert.match(html, /href="\.\/procedure-training\.html">Academia/);
    assert.match(html, /href="#instalar">Integrar/);
  });

  it("keeps the primary product actions and explicit backend installation", async () => {
    const html = await readHomepage();
    const js = await readProductJs();
    assert.match(html, /id="open-chat-btn"/);
    assert.match(html, /Ver cómo funciona/);
    assert.match(html, /data-api-url="https:\/\/api\.tu-dominio\.gt"/);
    assert.match(html, /id="widget-url"/);
    assert.match(js, /\[data-open-assistant\]/);
    assert.match(js, /navigator\.clipboard\.writeText/);
  });

  it("uses the restrained heritage-burgundy theme and accessible interaction tokens", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    const glass = await readLiquidGlassCss();
    assert.match(html, /data-theme="heritage-burgundy"/);
    assert.match(html, /name="theme-color" content="#731729"/);
    assert.match(html, /href="\.\/product\.css"/);
    assert.match(html, /href="\.\/liquid-glass\.css"/);
    assert.match(html, /src="\.\/product\.js"/);
    assert.match(html, /class="skip-link"/);
    assert.match(css, /--bg:#f7f3ee/);
    assert.match(css, /--surface:#fffdf9/);
    assert.match(css, /--action:#731729/);
    assert.match(css, /--action-soft:#f4e8ea/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
    assert.doesNotMatch(css, /#22d3ee|#8b5cf6|#ec4899|#67e8f9/i);
    assert.match(glass, /--glass-paper:#fffdf9/);
    assert.match(glass, /backdrop-filter:blur/);
    assert.match(glass, /prefers-reduced-transparency:reduce/);
    assert.match(glass, /prefers-contrast:more/);
    assert.match(glass, /forced-colors:active/);
    assert.doesNotMatch(glass, /#22d3ee|#8b5cf6|#ec4899|#67e8f9/i);
  });

  it("keeps the plain-language technical room safe and available", async () => {
    const html = await readGlassWall();
    assert.match(html, /lang="es"/);
    assert.match(html, /Cómo funciona · vista técnica/);
    assert.match(html, /Vista técnica/);
    assert.match(html, /Qué puedes inspeccionar/);
    assert.doesNotMatch(html, /Sin caja negra/);
    assert.match(html, /approvedEndpointPaths/);
    assert.match(html, /prefers-reduced-motion/);
  });
});
