import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HUMAN_SHELL_CSS, HUMAN_SHELL_HTML, HUMAN_SHELL_JS } from "../humanShell/assets.js";

const declaredIds = (): string[] =>
  [...HUMAN_SHELL_HTML.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);

describe("Feature 081 automated accessibility complement", () => {
  it("keeps unauthenticated product navigation out of the accessibility tree", () => {
    assert.match(HUMAN_SHELL_HTML, /<nav id="product-navigation"[^>]*hidden>/);
    assert.match(
      HUMAN_SHELL_JS,
      /byId\("product-navigation"\)\.hidden = !authenticated/
    );
    assert.match(HUMAN_SHELL_HTML, /id="shell-unauthenticated"[^>]*hidden/);
    assert.match(HUMAN_SHELL_JS, /setState\("unauthenticated", "Acceso requerido"\)/);
  });

  it("uses unique IDs and valid internal accessibility references", () => {
    const ids = declaredIds();
    assert.equal(ids.length, new Set(ids).size, "shell IDs must be unique");
    const idSet = new Set(ids);
    for (const match of HUMAN_SHELL_HTML.matchAll(/aria-labelledby="([^"]+)"/g)) {
      for (const referencedId of match[1]!.split(/\s+/)) {
        assert.ok(idSet.has(referencedId), `missing aria-labelledby target ${referencedId}`);
      }
    }
    for (const match of HUMAN_SHELL_HTML.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(idSet.has(match[1]!), `missing fragment target ${match[1]}`);
    }
  });

  it("provides semantic landmarks, language, status and keyboard affordances", () => {
    assert.match(HUMAN_SHELL_HTML, /<html lang="es">/);
    assert.match(HUMAN_SHELL_HTML, /class="skip-link" href="#workspace-main"/);
    assert.match(HUMAN_SHELL_HTML, /<header class="topbar">/);
    assert.match(HUMAN_SHELL_HTML, /<aside class="sidebar" aria-label="Navegación del producto">/);
    assert.match(HUMAN_SHELL_HTML, /<main id="workspace-main"[^>]*tabindex="-1">/);
    assert.ok([...HUMAN_SHELL_HTML.matchAll(/aria-live="polite"/g)].length >= 2);
    assert.match(HUMAN_SHELL_HTML, /role="status"/);
    assert.match(HUMAN_SHELL_CSS, /:focus-visible/);
    assert.match(HUMAN_SHELL_CSS, /\.skip-link:focus/);
  });

  it("supports narrow layouts and reduced motion without horizontal overflow assumptions", () => {
    assert.doesNotMatch(HUMAN_SHELL_CSS, /html\s*\{[^}]*\bmin-width\s*:/);
    assert.match(HUMAN_SHELL_CSS, /@media \(max-width: 820px\)/);
    assert.match(HUMAN_SHELL_CSS, /@media \(max-width: 560px\)/);
    assert.match(HUMAN_SHELL_CSS, /grid-template-areas: "top" "side" "main"/);
    assert.match(HUMAN_SHELL_CSS, /overflow-x: auto/);
    assert.match(HUMAN_SHELL_CSS, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("ships executable browser checks for names, targets, headings and focus containment", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile("scripts/human-product-shell-browser-smoke.mjs", "utf8")
    );
    assert.match(source, /const assertAccessibleShell = async/);
    assert.match(source, /duplicateIds/);
    assert.match(source, /unnamedInteractive/);
    assert.match(source, /undersizedTargets/);
    assert.match(source, /headingJumps/);
    assert.match(source, /hiddenFocusableVisible/);
    assert.match(source, /rect\.width < 24 \|\| rect\.height < 24/);
    assert.match(source, /setViewportSize\(\{ width: 320, height: 900 \}\)/);
    assert.match(source, /documentElement\.style\.overflowY = "scroll"/);
    assert.match(source, /rootMinWidth: getComputedStyle\(document\.documentElement\)\.minWidth/);
    assert.match(source, /document\.documentElement\.scrollWidth - viewportWidth/);
  });

  it("checks both anonymous and permission-aware authenticated states", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile("scripts/human-product-shell-browser-smoke.mjs", "utf8")
    );
    assert.match(source, /state: "unauthenticated", visibleRoutes: \[\]/);
    assert.match(source, /state: "authenticated", visibleRoutes: visible/);
    assert.match(source, /page\.keyboard\.press\("Tab"\)/);
    assert.match(source, /\.skip-link.*document\.activeElement/);
    assert.match(source, /location\.hash = '%22%5D%2C%20%5Bdata-route%5D'/);
    assert.match(source, /productive_authenticated_journeys: "0\/12"/);
  });
});
