import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-HUMAN-PRODUCT-SHELL-ACCESSIBILITY-001", () => {
  it("removes product navigation from anonymous accessibility state", async () => {
    const assets = await read("src/humanShell/assets.ts");
    assert.ok(assets.includes('<nav id="product-navigation" aria-label="Navegación del producto" hidden>'));
    assert.match(assets, /byId\("product-navigation"\)\.hidden = !authenticated/);
  });

  it("checks accessible names, IDs, targets, headings and hidden focus", async () => {
    const smoke = await read("scripts/human-product-shell-browser-smoke.mjs");
    for (const token of [
      "duplicateIds",
      "unnamedInteractive",
      "undersizedTargets",
      "headingJumps",
      "hiddenFocusableVisible",
      "currentPageCount",
    ]) assert.match(smoke, new RegExp(token));
    assert.match(smoke, /rect\.width < 24 \|\| rect\.height < 24/);
    assert.match(smoke, /Object\.keys|accessibleName|aria-labelledby/);
  });

  it("checks keyboard skip navigation and narrow viewport reflow", async () => {
    const smoke = await read("scripts/human-product-shell-browser-smoke.mjs");
    assert.match(smoke, /page\.keyboard\.press\("Tab"\)/);
    assert.match(smoke, /element === document\.activeElement/);
    assert.match(smoke, /setViewportSize\(\{ width: 320, height: 900 \}\)/);
    assert.match(smoke, /document\.documentElement\.scrollWidth - viewportWidth/);
    assert.match(smoke, /overflow <= 1/);
  });

  it("audits anonymous and permission-aware authenticated states", async () => {
    const smoke = await read("scripts/human-product-shell-browser-smoke.mjs");
    assert.match(smoke, /state: "unauthenticated", visibleRoutes: \[\]/);
    assert.match(smoke, /state: "authenticated", visibleRoutes: visible/);
    assert.match(smoke, /expectedAuthenticated \? 1 : 0/);
    assert.match(smoke, /productive_authenticated_journeys: "0\/12"/);
  });

  it("preserves role, malformed-route, session and storage protections", async () => {
    const smoke = await read("scripts/human-product-shell-browser-smoke.mjs");
    assert.match(smoke, /expectedRole/);
    assert.match(smoke, /location\.hash = '%22%5D%2C%20%5Bdata-route%5D'/);
    assert.match(smoke, /rotate-session/);
    assert.match(smoke, /logout/);
    assert.match(smoke, /localStorage\.length/);
    assert.match(smoke, /sessionStorage\.length/);
    assert.match(smoke, /document\.cookie/);
  });

  it("requires Chromium, Firefox and WebKit in the cross-browser gate", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    const script = packageJson.scripts["smoke:human-product-shell-cross-browser"] ?? "";
    assert.match(script, /chromium/);
    assert.match(script, /firefox/);
    assert.match(script, /webkit/);
    assert.match(script, /HUMAN_SHELL_BROWSER/);
    const workflow = await read(".github/workflows/public-browser.yml");
    assert.match(workflow, /playwright install --with-deps chromium firefox webkit/);
    assert.match(workflow, /smoke:human-product-shell-cross-browser/);
  });

  it("documents automation as a complement rather than conformance", async () => {
    const spec = await read("specs/081-human-product-shell-accessibility-v1/spec.md");
    const product = await read("docs/product/human-product-shell-accessibility.md");
    const adr = await read("docs/decisions/081-automated-accessibility-complement.md");
    assert.match(spec, /do not calculate color contrast or assert a WCAG conformance level/i);
    assert.match(product, /does not assert WCAG conformance/i);
    assert.match(product, /screen-reader review/i);
    assert.match(adr, /complement, not conformance/i);
  });

  it("keeps productive identity, environment and human acceptance open", async () => {
    const spec = await read("specs/081-human-product-shell-accessibility-v1/spec.md");
    const risk = await read("docs/risks/081-human-product-shell-accessibility-risk-register.md");
    const review = await read("docs/reviews/081-human-product-shell-accessibility-independent-review.md");
    assert.match(spec, /No productive IdP, real ephemeral environment, external municipal user/);
    assert.match(spec, /not production readiness/i);
    assert.match(risk, /complete authenticated module workflows and representative content absent/);
    assert.match(review, /not human acceptance or production readiness/i);
  });

  it("wires focused, cross-browser and named-EVAL commands", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    assert.match(packageJson.scripts["test:human-product-shell-accessibility"] ?? "", /human-product-shell-accessibility-v1/);
    assert.match(packageJson.scripts["eval:human-product-shell-accessibility"] ?? "", /eval-human-product-shell-accessibility-001/);
    assert.match(packageJson.scripts["smoke:human-product-shell-cross-browser"] ?? "", /human-product-shell-browser-smoke/);
    const workflow = await read(".github/workflows/ci.yml");
    assert.match(workflow, /EVAL-HUMAN-PRODUCT-SHELL-ACCESSIBILITY-001/);
  });
});
