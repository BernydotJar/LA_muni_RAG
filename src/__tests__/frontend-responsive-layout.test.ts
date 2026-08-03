import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readHomepage = async (): Promise<string> => readFile("public/index.html", "utf-8");
const readProductCss = async (): Promise<string> => readFile("public/product.css", "utf-8");
const readLiquidGlassCss = async (): Promise<string> => readFile("public/liquid-glass.css", "utf-8");
const readCivicHero = async (): Promise<string> => readFile("public/assets/civic-institutional-hero.svg", "utf-8");

describe("frontend responsive product layout", () => {
  it("uses a sticky product navigation rail with direct primary destinations", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(css, /--nav-height:76px/);
    assert.match(css, /\.app-nav\{position:sticky;top:18px/);
    assert.match(css, /width:min\(1180px,calc\(100% - 40px\)\)/);
    assert.match(html, /data-open-assistant>Asistente/);
    assert.match(html, /href="\.\/glass-wall\.html">Glass Wall/);
  });

  it("keeps restrained ambient motion and a monochromatic civic palace hero", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    const asset = await readCivicHero();
    assert.match(css, /ambient-orb/);
    assert.match(css, /orb-drift/);
    assert.match(html, /\.\/assets\/civic-institutional-hero\.svg/);
    assert.match(html, /civic-palace-visual/);
    assert.match(asset, /Ilustración editorial monocromática/);
    assert.match(asset, /arcos coloniales/);
    assert.match(asset, /campanario/);
    assert.match(asset, /cúpula/);
    assert.doesNotMatch(asset, /#22d3ee|#a855f7|#e879f9|#f59e0b/i);
  });

  it("keeps the public hero side-by-side on laptop viewports", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(css, /grid-template-columns:minmax\(360px,\.88fr\) minmax\(500px,1\.12fr\)/);
    assert.match(html, /hero-copy-stack/);
    assert.match(css, /min-height:calc\(100svh - var\(--nav-height\) - 18px\)/);
  });

  it("contains the evidence dossier in predictable opaque paper surfaces", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    assert.match(html, /hero-observation-card/);
    assert.match(html, /evidence-dossier/);
    assert.match(html, /route-list/);
    assert.match(css, /min-height:clamp\(520px,49vw,640px\)/);
    assert.match(css, /max-height:660px/);
    assert.match(css, /background:var\(--surface\)/);
    assert.match(css, /grid-template-columns:38px 1fr/);
  });

  it("stacks the product and preserves readable evidence rows on mobile", async () => {
    const css = await readProductCss();
    const glass = await readLiquidGlassCss();
    assert.match(css, /@media\(max-width:1040px\)/);
    assert.match(css, /\.hero-grid\{grid-template-columns:1fr\}/);
    assert.match(css, /@media\(max-width:760px\)/);
    assert.match(css, /\.panel-node\{position:relative;inset:auto;width:100%;max-width:none\}/);
    assert.match(css, /\.assurance-grid\{grid-template-columns:1fr\}/);
    assert.match(css, /#muni-rag-widget\{right:18px!important;bottom:18px!important\}/);
    assert.match(glass, /html\{min-width:280px\}/);
    assert.match(glass, /@media\(max-width:360px\)/);
    assert.match(glass, /grid-template-columns:34px minmax\(0,1fr\)/);
    assert.match(glass, /@media\(pointer:coarse\)/);
    assert.match(glass, /min-height:48px/);
  });

  it("preserves focus, reduced motion, and readable secondary text", async () => {
    const html = await readHomepage();
    const css = await readProductCss();
    const glass = await readLiquidGlassCss();
    assert.match(html, /class="skip-link"/);
    assert.match(css, /--muted:#625b56/);
    assert.match(css, /--quiet:#786f69/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion:reduce/);
    assert.match(glass, /prefers-reduced-transparency:reduce/);
    assert.match(glass, /prefers-contrast:more/);
    assert.match(glass, /forced-colors:active/);
  });
});
