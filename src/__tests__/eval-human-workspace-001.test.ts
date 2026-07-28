import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-HUMAN-WORKSPACE-001", () => {
  it("centers the workspace on municipal evidence work", async () => {
    const assets = await read("src/humanShell/assets.ts");
    assert.match(assets, /Mesa de evidencia municipal/);
    assert.match(assets, /Encontrar y sostener evidencia municipal/);
    assert.match(assets, /Elige una tarea/);
    assert.match(assets, /Estado verificable/);
    assert.match(assets, /<details class=\\?"session-details\\?">/);
    assert.doesNotMatch(assets, /class=\\?"metric-grid\\?"/);
    assert.doesNotMatch(assets, /linear-gradient|radial-gradient|backdrop-filter|box-shadow/i);
  });

  it("serves an exact protected journey-path allowlist", async () => {
    const handler = await read("src/humanShell/handler.ts");
    for (const path of [
      "/app/login",
      "/app/search",
      "/app/research",
      "/app/procedures",
      "/app/cases",
      "/app/sources",
      "/app/documents",
      "/app/ingestion",
      "/app/workflows",
      "/app/workflows/review",
      "/app/workflows/approve",
      "/app/admin/identity",
      "/app/audit",
      "/app/platform",
      "/app/accessibility",
      "/app/tenant-boundary",
    ]) {
      assert.ok(handler.includes(`"${path}"`), path);
    }
    assert.match(handler, /SHELL_HTML_ROUTES\.has\(url\.pathname\)/);
    assert.match(handler, /sendMethodNotAllowed/);
    assert.match(handler, /no-store, max-age=0/);
  });

  it("uses closed permission-aware routes without reflection", async () => {
    const assets = await read("src/humanShell/assets.ts");
    assert.match(assets, /const routePaths = Object\.freeze/);
    assert.match(assets, /const pathRoutes = Object\.freeze/);
    assert.match(assets, /buttons\.find\(\(button\) => button\.dataset\.route === requested\)/);
    assert.match(assets, /action\.hidden \|\| !isGranted\(action\.dataset\.permission/);
    assert.match(assets, /history\.pushState\(null, "", destination\)/);
    assert.match(assets, /alert\.dataset\.tone = "warning"/);
    assert.match(assets, /delete alert\.dataset\.tone/);
    assert.match(assets, /return_to=" \+ encodeURIComponent\(returnPath\)/);
    assert.match(assets, /--focus: #7c2d12/);
    assert.match(assets, /La vista solicitada no está disponible para esta membresía/);
    assert.doesNotMatch(assets, /querySelector\([^\n]*requested|textContent\s*=\s*requested/);
  });

  it("represents missing productive prerequisites instead of fake results", async () => {
    const assets = await read("src/humanShell/assets.ts");
    assert.match(assets, /Cero fuentes reales aprobadas/);
    assert.match(assets, /Cero documentos reales ingeridos/);
    assert.match(assets, /No hay un corpus real aprobado/);
    assert.match(assets, /Journeys productivas/);
    assert.match(assets, /0 de 12/);
    assert.doesNotMatch(assets, /<form\b|mock result|resultado simulado/i);
  });

  it("retains and improves the cross-browser reflow gate", async () => {
    const smoke = await read("scripts/human-product-shell-browser-smoke.mjs");
    assert.match(smoke, /canonical_deep_links: true/);
    assert.match(smoke, /task_first_workspace: true/);
    assert.match(smoke, /return_to=%2Fapp%2Fsearch/);
    assert.match(smoke, /location\.pathname === "\/app\/search"/);
    assert.match(smoke, /location\.pathname === "\/app\/admin\/identity"/);
    assert.match(smoke, /page\.goBack\(\)/);
    assert.match(smoke, /page\.goForward\(\)/);
    assert.match(smoke, /overflowElements/);
    assert.match(smoke, /setViewportSize\(\{ width: 320, height: 900 \}\)/);
    assert.match(smoke, /productive_authenticated_journeys: "0\/12"/);
  });

  it("repairs the inherited Feature 079 executable contract", async () => {
    const types = await read("src/humanSession/types.ts");
    const handler = await read("src/humanSession/handler.ts");
    const providerErrors = await read("src/humanSession/providerErrors.ts");
    const testAdapter = await read("src/humanSession/testAdapter.ts");
    const server = await read("src/server.ts");
    assert.match(types, /export interface HumanSessionTelemetryEvent/);
    assert.match(types, /export interface HumanSessionTelemetry/);
    assert.match(types, /monotonicNow: \(\) => number/);
    assert.match(types, /telemetry: HumanSessionTelemetry/);
    assert.match(handler, /HumanSessionTelemetryOperation/);
    assert.match(handler, /HumanIdentityProviderAuthenticationError/);
    assert.match(handler, /HumanIdentityProviderUnavailableError[\s\S]*503,[\s\S]*"human_identity_unavailable",[\s\S]*"provider_rejected",[\s\S]*true,[\s\S]*true/);
    assert.match(providerErrors, /HumanIdentityProviderUnavailableError/);
    assert.match(testAdapter, /throw new HumanIdentityProviderAuthenticationError\(\)/);
    assert.match(server, /allowedReturnPaths:[\s\S]*HUMAN_SHELL_RETURN_PATHS/);
  });

  it("documents reference use, critique and remaining blockers", async () => {
    const spec = await read("specs/082-task-first-human-workspace-v1/spec.md");
    const adr = await read("docs/decisions/082-task-first-civic-workspace.md");
    const risk = await read("docs/risks/082-task-first-human-workspace-risk-register.md");
    const review = await read("docs/reviews/082-task-first-human-workspace-independent-review.md");
    assert.match(spec, /Productive authenticated journeys remain 0\/12/);
    assert.match(spec, /not production readiness/i);
    assert.match(adr, /PixelRAG/);
    assert.match(adr, /No PixelRAG code, visual assets or deployment architecture were copied/);
    assert.match(risk, /Local shell is mistaken for production completion/);
    assert.match(review, /not production ready/i);
  });

  it("wires focused and named-EVAL CI commands", async () => {
    const packageJson = JSON.parse(await read("package.json")) as {
      scripts: Record<string, string>;
    };
    assert.match(packageJson.scripts["test:human-workspace"] ?? "", /human-product-workspace-v1/);
    assert.match(packageJson.scripts["eval:human-workspace"] ?? "", /eval-human-workspace-001/);
    const ci = await read(".github/workflows/ci.yml");
    assert.match(ci, /EVAL-HUMAN-WORKSPACE-001/);
    assert.match(ci, /test:human-workspace/);
  });
});

