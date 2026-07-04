import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("premium RAG frontend refresh", () => {
  it("keeps the evidence-first municipal RAG narrative", async () => {
    const html = await readHomepage();

    assert.match(html, /RAG municipal con evidencia verificable/);
    assert.match(html, /Consulta pública/);
    assert.match(html, /Sin caja negra/);
    assert.match(html, /not_found/);
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

  it("keeps the RAG Glass Wall entry point", async () => {
    const html = await readHomepage();

    assert.match(html, /glass-wall\.html/);
    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /modo CTO 90s neon/);
  });

  it("adds scroll-driven motion while respecting reduced motion", async () => {
    const html = await readHomepage();

    assert.match(html, /--scroll/);
    assert.match(html, /updateScrollProgress/);
    assert.match(html, /prefers-reduced-motion/);
  });

  it("aligns the Glass Wall technical room with the premium frontend", async () => {
    const html = await readGlassWall();

    assert.match(html, /Back to LA Muni RAG/);
    assert.match(html, /Technical room/);
    assert.match(html, /premium technical room/);
    assert.match(html, /No black box/);
    assert.match(html, /prefers-reduced-motion/);
  });

  it("keeps Glass Wall safe endpoints and safety copy", async () => {
    const html = await readGlassWall();

    assert.match(html, /approvedEndpointPaths = \["\/health", "\/api\/evidence", "\/api\/answer"\]/);
    assert.match(html, /It does not render prompts, credentials/);
    assert.match(html, /database URLs/);
    assert.match(html, /chain-of-thought/);
  });
});
