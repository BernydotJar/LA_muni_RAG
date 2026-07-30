import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readProductCss = async (): Promise<string> => readFile("public/product.css", "utf-8");
const readCivicHero = async (): Promise<string> => readFile("public/assets/civic-institutional-hero.svg", "utf-8");

describe("frontend responsive product layout", () => {
  it("uses a sticky product navigation rail with direct primary destinations", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(css, /--nav-height:78px/);
    assert.match(css, /\.app-nav\{position:sticky;top:18px/);
    assert.match(css, /width:min\(1180px,calc\(100% - 40px\)\)/);
    assert.match(html, /data-open-assistant>Asistente/);
    assert.match(html, /href="\.\/glass-wall\.html">Glass Wall/);
  });

  it("keeps restrained ambient motion and the civic palace hero", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    const asset = await readCivicHero();
    assert.match(css, /ambient-orb/);
    assert.match(css, /orb-drift/);
    assert.match(html, /\.\/assets\/civic-institutional-hero\.svg/);
    assert.match(html, /civic-palace-visual/);
    assert.match(asset, /Palacio municipal futurista/);
    assert.match(asset, /arcos coloniales/);
    assert.match(asset, /campanario/);
    assert.match(asset, /cúpula/);
  });

  it("keeps the public hero side-by-side on laptop viewports", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(css, /grid-template-columns:minmax\(340px,\.82fr\) minmax\(460px,1\.18fr\)/);
    assert.match(html, /hero-copy-stack/);
    assert.match(css, /min-height:calc\(100svh - var\(--nav-height\) - 18px\)/);
  });

  it("contains the observation card and panel nodes within predictable opaque surfaces", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(html, /hero-observation-card/);
    assert.match(css, /min-height:clamp\(460px,48vw,620px\)/);
    assert.match(css, /max-height:650px/);
    assert.match(css, /width:clamp\(180px,19vw,224px\)/);
    assert.match(css, /max-width:calc\(50% - 24px\)/);
    assert.match(css, /background:rgba\(6,9,22,\.94\)/);
  });

  it("stacks the product and removes absolute panel positioning on mobile", async () => {
    const css = await readProductCss();
    assert.match(css, /@media\(max-width:960px\)/);
    assert.match(css, /\.hero-grid\{grid-template-columns:1fr\}/);
    assert.match(css, /@media\(max-width:760px\)/);
    assert.match(css, /\.hero-observation-card\{min-height:auto;padding:22px;display:grid;gap:12px\}/);
    assert.match(css, /\.panel-node\{position:relative;inset:auto;width:100%;max-width:none\}/);
    assert.match(css, /#muni-rag-widget\{right:18px!important;bottom:18px!important\}/);
  });

  it("preserves focus, reduced motion, and readable secondary text", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(html, /class="skip-link"/);
    assert.match(css, /--muted:#cbd5e1/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion:reduce/);
  });
});
