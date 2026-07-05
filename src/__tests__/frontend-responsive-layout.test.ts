import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");

describe("frontend responsive layout stabilization", () => {
  it("uses a cinematic sticky app rail instead of a flat header bar", async () => {
    const html = await readHomepage();

    assert.match(html, /--nav-height: 76px/);
    assert.match(html, /position: sticky;\n      top: 18px/);
    assert.match(html, /width: min\(1180px, calc\(100% - 40px\)\)/);
    assert.match(html, /border-radius: 28px/);
    assert.match(html, /nav::before/);
    assert.match(html, /rail-shimmer/);
  });

  it("keeps the public hero side-by-side on laptop viewports", async () => {
    const html = await readHomepage();

    assert.match(html, /grid-template-columns: minmax\(340px, 0\.82fr\) minmax\(460px, 1\.18fr\)/);
    assert.match(html, /hero-copy-stack/);
    assert.match(html, /min-height: calc\(100svh - var\(--nav-height\) - 18px\)/);
    assert.doesNotMatch(html, /\.hero-observation-card \{ order: -1/);
  });

  it("contains the Antigua observation card and panel nodes inside responsive bounds", async () => {
    const html = await readHomepage();

    assert.match(html, /hero-observation-card/);
    assert.match(html, /min-height: clamp\(460px, 48vw, 620px\)/);
    assert.match(html, /max-height: 650px/);
    assert.match(html, /width: clamp\(176px, 19vw, 220px\)/);
    assert.match(html, /max-width: calc\(50% - 24px\)/);
    assert.match(html, /panel-float/);
    assert.match(html, /architecture-glow/);
  });

  it("flattens cinematic cards only at tablet/mobile widths", async () => {
    const html = await readHomepage();

    assert.match(html, /@media \(max-width: 960px\)/);
    assert.match(html, /\.cinematic-stage \{ position: relative; top: auto; min-height: auto; display: grid; grid-template-columns: 1fr; gap: 16px; padding: 24px; overflow: visible; \}/);
    assert.match(html, /\.story-card \{ position: relative; inset: auto; width: 100%; \}/);
    assert.match(html, /\.stage-core \{ width: min\(320px, 72vw\); margin: 0 auto; \}/);
  });

  it("keeps mobile cards readable instead of absolute-positioned over decorative art", async () => {
    const html = await readHomepage();

    assert.match(html, /@media \(max-width: 760px\)/);
    assert.match(html, /\.hero-observation-card \{ min-height: auto; padding: 22px; display: grid; gap: 12px; \}/);
    assert.match(html, /\.panel-node \{ position: relative; width: 100%; max-width: none; left: auto; right: auto; top: auto; bottom: auto; animation: none; \}/);
    assert.match(html, /#muni-rag-widget \{ right: 18px !important; bottom: 18px !important; \}/);
  });

  it("preserves the Spanish product narrative, widget, Glass Wall link, and reduced motion", async () => {
    const html = await readHomepage();

    assert.match(html, /RAG municipal con evidencia verificable/);
    assert.match(html, /Asistente documental para la Municipalidad de La Antigua Guatemala/);
    assert.match(html, /href="\/glass-wall\.html"/);
    assert.match(html, /<script src="\/widget\.js"><\/script>/);
    assert.match(html, /window\.location\.origin \+ '\/widget\.js'/);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /updateScrollProgress/);
  });
});
