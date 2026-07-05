import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");

describe("frontend responsive layout stabilization", () => {
  it("keeps the public hero bounded below the sticky navigation", async () => {
    const html = await readHomepage();

    assert.match(html, /--nav-height: 86px/);
    assert.match(html, /scroll-padding-top: calc\(var\(--nav-height\) \+ 24px\)/);
    assert.match(html, /\.hero, \.section, \.cinematic-strip \{ scroll-margin-top: calc\(var\(--nav-height\) \+ 24px\); \}/);
    assert.match(html, /min-height: calc\(100svh - var\(--nav-height\)\)/);
  });

  it("contains the Antigua observation card and panel nodes inside responsive bounds", async () => {
    const html = await readHomepage();

    assert.match(html, /hero-observation-card/);
    assert.match(html, /min-height: clamp\(430px, 52vw, 600px\)/);
    assert.match(html, /max-height: 640px/);
    assert.match(html, /width: clamp\(176px, 19vw, 220px\)/);
    assert.match(html, /max-width: calc\(50% - 24px\)/);
    assert.match(html, /\.node-d \{ right: clamp\(18px, 4vw, 34px\); bottom: clamp\(72px, 11vw, 104px\)/);
  });

  it("flattens cinematic cards before they can overflow laptop and tablet viewports", async () => {
    const html = await readHomepage();

    assert.match(html, /@media \(max-width: 1180px\)/);
    assert.match(html, /\.cinematic-stage \{ position: relative; top: auto; min-height: auto; display: grid; grid-template-columns: 1fr; gap: 16px; padding: 24px; overflow: visible; \}/);
    assert.match(html, /\.story-card \{ position: relative; inset: auto; width: 100%; \}/);
    assert.match(html, /\.stage-core \{ width: min\(320px, 72vw\); margin: 0 auto; \}/);
  });

  it("keeps mobile cards readable instead of absolute-positioned over decorative art", async () => {
    const html = await readHomepage();

    assert.match(html, /@media \(max-width: 760px\)/);
    assert.match(html, /\.hero-observation-card \{ min-height: auto; padding: 22px; display: grid; gap: 12px; \}/);
    assert.match(html, /\.panel-node \{ position: relative; width: 100%; max-width: none; left: auto; right: auto; top: auto; bottom: auto; \}/);
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
