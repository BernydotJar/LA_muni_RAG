import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { describe, it } from "node:test";
import { HUMAN_SECURITY_ROLES, SECURITY_PERMISSIONS } from "../security/rbac.js";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-HUMAN-PRODUCT-SHELL-001", () => {
  it("serves a distinct same-origin shell with strict browser headers", async () => {
    const handler = await read("src/humanShell/handler.ts");
    const server = await read("src/server.ts");
    assert.match(handler, /HUMAN_SHELL_ROUTE = "\/app"/);
    assert.match(handler, /default-src 'none'/);
    assert.match(handler, /connect-src 'self'/);
    assert.match(handler, /frame-ancestors 'none'/);
    assert.match(handler, /no-store, max-age=0/);
    assert.match(handler, /cross-origin-opener-policy/);
    assert.match(handler, /cross-origin-resource-policy/);
    assert.match(handler, /x-frame-options/);
    assert.match(server, /handleHumanShell\(req, res, url\)/);
  });

  it("uses POST-only same-origin BFF lifecycle without browser credential storage", async () => {
    const assets = await read("src/humanShell/assets.ts");
    assert.match(assets, /method: "POST"/);
    assert.match(assets, /credentials: "same-origin"/);
    assert.match(assets, /"x-session-bootstrap": "v1"/);
    assert.match(assets, /"x-csrf-token": session\.csrf/);
    assert.doesNotMatch(assets, /localStorage\.(?:setItem|getItem)|sessionStorage\.(?:setItem|getItem)|indexedDB\.open/i);
    assert.doesNotMatch(assets, /document\.cookie\s*=/i);
    assert.doesNotMatch(assets, /authorization\s*:|headers\s*\.\s*authorization|["']Bearer\s+["']\s*\+/i);
    assert.doesNotMatch(assets, /\"integration_client\"|\"integration:query\"/);
    assert.doesNotMatch(assets, /innerHTML|outerHTML|insertAdjacentHTML|eval\s*\(|new Function/i);
  });

  it("binds every declared module to a canonical local permission", async () => {
    const assets = await read("src/humanShell/assets.ts");
    const declared = [...assets.matchAll(/data-permission=\\?"([^"\\]+)\\?"/g)]
      .map((match) => match[1]!)
      .filter((value, index, all) => all.indexOf(value) === index);
    assert.ok(declared.length >= 12);
    assert.ok(declared.every((permission) =>
      (SECURITY_PERMISSIONS as readonly string[]).includes(permission)
    ));
    assert.ok(!declared.includes("integration:query"));
    assert.match(assets, /buttons\.find\(\(button\) => button\.dataset\.route === requested\)/);
    assert.doesNotMatch(assets, /querySelector\('\[data-route="' \+ requested/);
  });

  it("separates human roles from integration credentials in code and PostgreSQL", async () => {
    assert.ok(!HUMAN_SECURITY_ROLES.includes("integration_client" as never));
    const migration = await read("db/migrations/017_human_session_bff.sql");
    const runtimeGate = await read("db/tests/human_session_bff_runtime_gate.sql");
    assert.ok(
      [...migration.matchAll(/membership\.role::text <> 'integration_client'/g)].length >= 4
    );
    assert.match(runtimeGate, /integration-only role was accepted as human membership/);
    assert.match(runtimeGate, /integration-only human session was created/);
  });

  it("provides bounded accessibility and responsive foundations", async () => {
    const assets = await read("src/humanShell/assets.ts");
    assert.match(assets, /<html lang=\\?"es\\?">/);
    assert.match(assets, /Saltar al espacio de trabajo/);
    assert.match(assets, /aria-label=\\?"Navegación del producto\\?"/);
    assert.match(assets, /aria-live=\\?"polite\\?"/);
    assert.match(assets, /:focus-visible/);
    assert.match(assets, /@media \(max-width: 820px\)/);
    assert.match(assets, /@media \(max-width: 560px\)/);
    assert.match(assets, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("keeps the authenticated shell outside the public Pages artifact", async () => {
    const publicEntries = await readdir("public", { recursive: true });
    assert.ok(!publicEntries.some((entry) => entry === "app" || entry.startsWith("app/")));
    const pagesBuilder = await read("scripts/build-pages.mjs");
    assert.match(pagesBuilder, /sourceDir = join\(repoRoot, "public"\)/);
    assert.doesNotMatch(pagesBuilder, /humanShell|\/app\/shell/);
    for (const entry of publicEntries.filter((value) => value.endsWith(".html"))) {
      const html = await read(`public/${entry}`);
      assert.doesNotMatch(html, /href=["']\/app(?:["'#?])/);
    }
  });

  it("ships deterministic real-browser evidence for distinct local roles", async () => {
    const smoke = await read("scripts/human-product-shell-browser-smoke.mjs");
    assert.match(smoke, /VIEWER_SUBJECT/);
    assert.match(smoke, /ADMIN_SUBJECT/);
    assert.match(smoke, /role_aware_navigation: true/);
    assert.match(smoke, /session_rotation: true/);
    assert.match(smoke, /logout_revocation: true/);
    assert.match(smoke, /web_storage_credentials: false/);
    assert.match(smoke, /document_cookie_exposure: false/);
    assert.match(smoke, /productive_authenticated_journeys: "0\/12"/);
  });

  it("documents the deterministic boundary and unresolved productive prerequisites", async () => {
    const spec = await read("specs/078-authenticated-role-aware-product-shell-v1/spec.md");
    const product = await read("docs/product/human-product-shell.md");
    const adr = await read("docs/decisions/078-authenticated-role-aware-product-shell.md");
    assert.match(spec, /productive authenticated browser count remains `0\/12`/i);
    assert.match(spec, /not production readiness/i);
    assert.match(product, /test-only provider/i);
    assert.match(product, /official result remains `0\/12`/i);
    assert.match(adr, /productive IdP integration/);
  });

  it("wires focused, browser, named-EVAL and CI gates", async () => {
    const packageJson = JSON.parse(await read("package.json")) as { scripts: Record<string, string> };
    assert.match(packageJson.scripts["test:human-product-shell"] ?? "", /human-product-shell-v1/);
    assert.match(packageJson.scripts["smoke:human-product-shell-browser"] ?? "", /human-product-shell-browser-smoke/);
    assert.match(packageJson.scripts["eval:human-product-shell"] ?? "", /eval-human-product-shell-001/);
    const backendCi = await read(".github/workflows/ci.yml");
    const browserCi = await read(".github/workflows/public-browser.yml");
    assert.match(backendCi, /EVAL-HUMAN-PRODUCT-SHELL-001/);
    assert.match(browserCi, /smoke:human-product-shell-cross-browser/);
  });
});
