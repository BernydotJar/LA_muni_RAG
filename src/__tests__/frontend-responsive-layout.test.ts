import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readCivicHero = async (): Promise<string> => readFile("public/assets/civic-institutional-hero.svg", "utf-8");

describe("frontend responsive layout stabilization", () => {
  it("uses a cinematic sticky app rail instead of a flat header bar", async () => {
    const html = await readHomepage();

    assert.match(html, /--nav-height:76px|--nav-height: 76px/);
    assert.match(html, /nav\{position:sticky;top:18px|position: sticky;\n\s+top: 18px/);
    assert.match(html, /width:min\(1180px,calc\(100% - 40px\)\)|width: min\(1180px, calc\(100% - 40px\)\)/);
    assert.match(html, /border-radius:28px|border-radius: 28px/);
    assert.match(html, /nav::before/);
    assert.match(html, /rail-shimmer/);
  });

  it("brings back the premium orbital hero motion", async () => {
    const html = await readHomepage();

    assert.match(html, /orb-primary/);
    assert.match(html, /orb-secondary/);
    assert.match(html, /orb-ring-a/);
    assert.match(html, /orb-ring-b/);
    assert.match(html, /orb-drift/);
    assert.match(html, /orb-secondary-float/);
    assert.match(html, /ring-drift-a/);
    assert.match(html, /ring-drift-b/);
  });

  it("uses a civic palace asset instead of an abstract-only line drawing", async () => {
    const html = await readHomepage();
    const asset = await readCivicHero();

    assert.match(html, /\/assets\/civic-institutional-hero\.svg/);
    assert.match(html, /civic-palace-visual/);
    assert.match(html, /municipalidad o congreso/i);
    assert.match(asset, /Palacio municipal futurista/);
    assert.match(asset, /municipalidad o congreso/i);
    assert.match(asset, /arcos coloniales/);
    assert.match(asset, /campanario/);
    assert.match(asset, /cúpula/);
    assert.match(asset, /ring-drift-a|spinA/);
    assert.match(asset, /ring-drift-b|spinB/);
  });

  it("keeps the public hero side-by-side on laptop viewports", async () => {
    const html = await readHomepage();

    assert.match(html, /grid-template-columns:minmax\(340px,\.82fr\) minmax\(460px,1\.18fr\)|grid-template-columns: minmax\(340px, 0\.82fr\) minmax\(460px, 1\.18fr\)/);
    assert.match(html, /hero-copy-stack/);
    assert.match(html, /min-height:calc\(100svh - var\(--nav-height\) - 18px\)|min-height: calc\(100svh - var\(--nav-height\) - 18px\)/);
    assert.doesNotMatch(html, /\.hero-observation-card \{ order: -1/);
  });

  it("contains the Antigua observation card and panel nodes inside responsive bounds", async () => {
    const html = await readHomepage();

    assert.match(html, /hero-observation-card/);
    assert.match(html, /min-height:clamp\(460px,48vw,620px\)|min-height: clamp\(460px, 48vw, 620px\)/);
    assert.match(html, /max-height:650px|max-height: 650px/);
    assert.match(html, /width:clamp\(176px,19vw,220px\)|width: clamp\(176px, 19vw, 220px\)/);
    assert.match(html, /max-width:calc\(50% - 24px\)|max-width: calc\(50% - 24px\)/);
    assert.match(html, /panel-float/);
    assert.match(html, /architecture-glow/);
  });

  it("flattens cinematic cards only at tablet and mobile widths", async () => {
    const html = await readHomepage();

    assert.match(html, /@media \(max-width:960px\)|@media \(max-width: 960px\)/);
    assert.match(html, /\.cinematic-stage\{position:relative;top:auto;min-height:auto;display:grid;grid-template-columns:1fr;gap:16px;padding:24px;overflow:visible\}|\.cinematic-stage \{ position: relative; top: auto; min-height: auto; display: grid; grid-template-columns: 1fr; gap: 16px; padding: 24px; overflow: visible; \}/);
    assert.match(html, /\.story-card\{position:relative;inset:auto;width:100%\}|\.story-card \{ position: relative; inset: auto; width: 100%; \}/);
    assert.match(html, /\.stage-core\{width:min\(320px,72vw\);margin:0 auto\}|\.stage-core \{ width: min\(320px, 72vw\); margin: 0 auto; \}/);
  });

  it("keeps mobile cards readable instead of absolute-positioned over decorative art", async () => {
    const html = await readHomepage();

    assert.match(html, /@media \(max-width:760px\)|@media \(max-width: 760px\)/);
    assert.match(html, /\.hero-observation-card\{min-height:auto;padding:22px;display:grid;gap:12px\}|\.hero-observation-card \{ min-height: auto; padding: 22px; display: grid; gap: 12px; \}/);
    assert.match(html, /\.panel-node\{position:relative;width:100%;max-width:none;left:auto;right:auto;top:auto;bottom:auto;animation:none\}|\.panel-node \{ position: relative; width: 100%; max-width: none; left: auto; right: auto; top: auto; bottom: auto; animation: none; \}/);
    assert.match(html, /#muni-rag-widget\{right:18px!important;bottom:18px!important\}|#muni-rag-widget \{ right: 18px !important; bottom: 18px !important; \}/);
  });

  it("preserves the Spanish product narrative, widget route, Glass Wall link, and reduced motion", async () => {
    const html = await readHomepage();

    assert.match(html, /RAG municipal con evidencia verificable/);
    assert.match(html, /Asistente documental para la Municipalidad de La Antigua Guatemala/);
    assert.match(html, /href="\/glass-wall\.html"/);
    assert.match(html, /widget\.js/);
    assert.match(html, /window\.location\.origin \+ '\/widget\.js'/);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /updateScrollProgress/);
  });
});
