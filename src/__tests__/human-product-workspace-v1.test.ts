import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { HUMAN_SHELL_CSS, HUMAN_SHELL_HTML, HUMAN_SHELL_JS } from "../humanShell/assets.js";
import {
  HUMAN_SHELL_DEEP_LINK_ROUTES,
  HUMAN_SHELL_RETURN_PATHS,
} from "../humanShell/handler.js";
import { SECURITY_PERMISSIONS } from "../security/rbac.js";
import { createApiServer } from "../server.js";

const EXPECTED_DEEP_LINKS = [
  "/app/login",
  "/app/search",
  "/app/research",
  "/app/procedures",
  "/app/cases",
  "/app/sources",
  "/app/documents",
  "/app/ingestion",
  "/app/workflows",
  "/app/workflows/author",
  "/app/workflows/review",
  "/app/workflows/approve",
  "/app/admin/identity",
  "/app/audit",
  "/app/platform",
  "/app/accessibility",
  "/app/tenant-boundary",
] as const;

const relativeLuminance = (hex: string): number => {
  const channels = hex.slice(1).match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

const contrastRatio = (left: string, right: string): number => {
  const values = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
};

describe("Feature 082 task-first human product workspace", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = createApiServer({ humanSession: { enabled: false } });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  });

  it("serves canonical journey deep links through the protected shell", async () => {
    assert.deepEqual(HUMAN_SHELL_DEEP_LINK_ROUTES, EXPECTED_DEEP_LINKS);
    assert.deepEqual(HUMAN_SHELL_RETURN_PATHS, ["/", "/app", ...EXPECTED_DEEP_LINKS]);
    for (const route of EXPECTED_DEEP_LINKS) {
      const response = await fetch(`${baseUrl}${route}`);
      assert.equal(response.status, 200, route);
      assert.equal(response.headers.get("content-type"), "text/html; charset=utf-8");
      assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
      assert.equal(await response.text(), HUMAN_SHELL_HTML);
    }
    const mutation = await fetch(`${baseUrl}/app/search`, { method: "POST" });
    assert.equal(mutation.status, 405);
    assert.equal(mutation.headers.get("allow"), "GET, HEAD");
  });

  it("uses a task-first civic workspace instead of a generic metric dashboard", () => {
    assert.match(HUMAN_SHELL_HTML, /Mesa de evidencia municipal/);
    assert.match(HUMAN_SHELL_HTML, /Encontrar y sostener evidencia municipal/);
    assert.match(HUMAN_SHELL_HTML, /data-action-route="evidence"/);
    assert.match(HUMAN_SHELL_HTML, /Estado verificable/);
    assert.match(HUMAN_SHELL_HTML, /Cero documentos reales ingeridos/);
    assert.match(HUMAN_SHELL_HTML, /Journeys productivas/);
    assert.doesNotMatch(HUMAN_SHELL_HTML, /class="metric-grid"/);
    assert.match(HUMAN_SHELL_HTML, /<details class="session-details">/);
    assert.doesNotMatch(
      HUMAN_SHELL_CSS,
      /linear-gradient|radial-gradient|backdrop-filter|box-shadow/i
    );
    assert.match(HUMAN_SHELL_CSS, /font-family: Georgia/);
    assert.match(HUMAN_SHELL_CSS, /@media \(forced-colors: active\)/);
  });

  it("keeps visible focus above the non-text contrast threshold", () => {
    assert.ok(contrastRatio("#7c2d12", "#fffdf8") >= 3);
    assert.ok(contrastRatio("#7c2d12", "#f4f0e7") >= 3);
    assert.ok(contrastRatio("#ffd166", "#0d2a33") >= 3);
    assert.match(HUMAN_SHELL_CSS, /--focus: #7c2d12/);
    assert.match(HUMAN_SHELL_CSS, /\.sidebar :focus-visible \{ outline-color: #ffd166; \}/);
  });

  it("keeps unavailable product data explicit and never fabricates results", () => {
    for (const statement of [
      "No hay un corpus real aprobado",
      "Cero fuentes reales aprobadas",
      "Cero documentos reales ingeridos",
      "Identidad productiva",
      "0 de 12",
    ]) {
      assert.ok(HUMAN_SHELL_HTML.includes(statement), statement);
    }
    assert.doesNotMatch(HUMAN_SHELL_HTML, /<form\b|mock result|resultado simulado/i);
    assert.match(HUMAN_SHELL_HTML, /No se muestran ejemplos sintéticos/);
  });

  it("maps deep links through closed route allowlists and local permissions", () => {
    for (const route of [
      "overview", "evidence", "procedures", "cases", "sources", "documents",
      "ingestion", "authoring", "review", "approval", "identity", "audit", "platform",
    ]) {
      assert.match(HUMAN_SHELL_JS, new RegExp(`${route}: "/app`));
    }
    assert.match(HUMAN_SHELL_JS, /buttons\.find\(\(button\) => button\.dataset\.route === requested\)/);
    assert.match(HUMAN_SHELL_JS, /action\.hidden \|\| !isGranted\(action\.dataset\.permission/);
    assert.match(HUMAN_SHELL_JS, /history\.replaceState\(null, "", destination\)/);
    assert.match(HUMAN_SHELL_JS, /history\.pushState\(null, "", destination\)/);
    assert.match(HUMAN_SHELL_JS, /alert\.dataset\.tone = "warning"/);
    assert.match(HUMAN_SHELL_JS, /delete alert\.dataset\.tone/);
    assert.match(HUMAN_SHELL_JS, /La vista solicitada no está disponible para esta membresía/);
    assert.match(HUMAN_SHELL_JS, /return_to=" \+ encodeURIComponent\(returnPath\)/);
    assert.doesNotMatch(HUMAN_SHELL_JS, /querySelector\([^\n]*requested|textContent\s*=\s*requested/);

    const declared = [...HUMAN_SHELL_HTML.matchAll(/data-permission="([^"]+)"/g)]
      .map((match) => match[1]!);
    assert.ok(declared.every((permission) =>
      (SECURITY_PERMISSIONS as readonly string[]).includes(permission)
    ));
  });

  it("preserves browser credential and public-surface boundaries", () => {
    assert.doesNotMatch(HUMAN_SHELL_JS, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
    assert.doesNotMatch(HUMAN_SHELL_JS, /authorization\s*:|Bearer\s+/i);
    assert.match(HUMAN_SHELL_JS, /credentials: "same-origin"/);
    assert.match(HUMAN_SHELL_JS, /"x-csrf-token": session\.csrf/);
    assert.match(HUMAN_SHELL_HTML, /Sin Bearer ni credenciales persistentes/);
  });
});

