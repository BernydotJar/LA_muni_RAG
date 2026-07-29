import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import {
  createHumanSessionBffDependencies,
  InMemoryHumanSessionRepository,
  sha256Hex,
} from "../humanSession/index.js";
import { HUMAN_SHELL_CSS, HUMAN_SHELL_HTML, HUMAN_SHELL_JS } from "../humanShell/assets.js";
import { SECURITY_PERMISSIONS } from "../security/rbac.js";
import { createApiServer } from "../server.js";

const UUIDS = {
  tenant: "11111111-1111-4111-8111-111111111111",
  principal: "22222222-2222-4222-8222-222222222222",
  subject: "33333333-3333-4333-8333-333333333333",
};

describe("Feature 078 authenticated role-aware product shell", () => {
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

  it("serves the shell with strict same-origin security headers", async () => {
    const response = await fetch(`${baseUrl}/app`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin");
    assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /connect-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /style-src 'self'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /form-action 'self'/);
    assert.equal(await response.text(), HUMAN_SHELL_HTML);
  });

  it("serves only GET/HEAD shell assets and rejects mutation methods", async () => {
    const css = await fetch(`${baseUrl}/app/shell.css`);
    const js = await fetch(`${baseUrl}/app/shell.js`);
    const favicon = await fetch(`${baseUrl}/app/favicon.svg`);
    const legacyFavicon = await fetch(`${baseUrl}/favicon.ico`);
    const head = await fetch(`${baseUrl}/app`, { method: "HEAD" });
    const mutation = await fetch(`${baseUrl}/app`, { method: "POST" });
    assert.equal(css.status, 200);
    assert.equal(css.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(await css.text(), HUMAN_SHELL_CSS);
    assert.equal(js.status, 200);
    assert.equal(js.headers.get("content-type"), "application/javascript; charset=utf-8");
    assert.equal(await js.text(), HUMAN_SHELL_JS);
    assert.equal(favicon.status, 200);
    assert.equal(favicon.headers.get("content-type"), "image/svg+xml; charset=utf-8");
    assert.equal(legacyFavicon.status, 200);
    assert.equal(legacyFavicon.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(mutation.status, 405);
    assert.equal(mutation.headers.get("allow"), "GET, HEAD");
  });

  it("fails closed through the BFF when human identity is disabled", async () => {
    const response = await fetch(`${baseUrl}/auth/session`, {
      method: "POST",
      headers: {
        origin: baseUrl,
        "x-session-bootstrap": "v1",
      },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "human_identity_unavailable",
        message: "Human sign-in is not configured",
      },
    });
  });

  it("advertises the shell boundary without claiming productive authentication", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      humanSessionBff: { enabled: boolean; bearerAcceptedInBrowser: boolean };
      humanProductShell: {
        route: string;
        sameOriginBffRequired: boolean;
        browserBearerAccepted: boolean;
      };
    };
    assert.deepEqual(body.humanProductShell, {
      route: "/app",
      sameOriginBffRequired: true,
      browserBearerAccepted: false,
    });
    assert.equal(body.humanSessionBff.enabled, false);
    assert.equal(body.humanSessionBff.bearerAcceptedInBrowser, false);
  });

  it("contains accessible state surfaces and a permission-bound navigation model", () => {
    assert.match(HUMAN_SHELL_HTML, /<html lang="es">/);
    assert.match(HUMAN_SHELL_HTML, /class="skip-link" href="#workspace-main"/);
    assert.match(HUMAN_SHELL_HTML, /aria-label="Navegación del producto"/);
    assert.match(HUMAN_SHELL_HTML, /id="workspace-main"[^>]*tabindex="-1"/);
    assert.match(HUMAN_SHELL_HTML, /aria-live="polite"/);
    assert.match(HUMAN_SHELL_HTML, /id="sign-in"[^>]*href="\/auth\/login\?return_to=%2Fapp"/);

    const declared = [...HUMAN_SHELL_HTML.matchAll(/data-permission="([^"]+)"/g)]
      .map((match) => match[1]!);
    assert.ok(declared.length >= 12);
    assert.ok(declared.every((permission) =>
      (SECURITY_PERMISSIONS as readonly string[]).includes(permission)
    ));
    assert.ok(!declared.includes("integration:query"));
    assert.ok(declared.includes("identity:manage"));
    assert.ok(declared.includes("platform:admin"));
  });

  it("keeps browser secrets in memory and uses same-origin POST lifecycle requests", () => {
    assert.doesNotMatch(HUMAN_SHELL_JS, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
    assert.doesNotMatch(HUMAN_SHELL_JS, /authorization\s*:|headers\s*\.\s*authorization|["']Bearer\s+["']\s*\+/i);
    assert.doesNotMatch(HUMAN_SHELL_JS, /integration_client|integration:query/);
    assert.doesNotMatch(HUMAN_SHELL_JS, /innerHTML|outerHTML|insertAdjacentHTML|eval\s*\(|new Function/i);
    assert.doesNotMatch(HUMAN_SHELL_JS, /console\./);
    assert.match(HUMAN_SHELL_JS, /credentials: "same-origin"/);
    assert.match(HUMAN_SHELL_JS, /method: "POST"/);
    assert.match(HUMAN_SHELL_JS, /"x-session-bootstrap": "v1"/);
    assert.match(HUMAN_SHELL_JS, /"x-csrf-token": session\.csrf/);
    assert.match(HUMAN_SHELL_JS, /history\.replaceState\(null, "", "\/app"\)/);
  });

  it("uses a bounded responsive and reduced-motion stylesheet", () => {
    assert.match(HUMAN_SHELL_CSS, /@media \(max-width: 820px\)/);
    assert.match(HUMAN_SHELL_CSS, /@media \(max-width: 560px\)/);
    assert.match(HUMAN_SHELL_CSS, /@media \(prefers-reduced-motion: reduce\)/);
    assert.doesNotMatch(HUMAN_SHELL_CSS, /html\s*\{[^}]*\bmin-width\s*:/);
    assert.match(HUMAN_SHELL_CSS, /\.topbar, \.sidebar, \.sidebar nav, \.workspace, #authenticated-workspace \{ min-width: 0; max-width: 100%; \}/);
    assert.match(HUMAN_SHELL_CSS, /:focus-visible/);
  });

  it("allows the official shell return path and rejects integration-only human roles", () => {
    const dependencies = createHumanSessionBffDependencies();
    assert.deepEqual(dependencies.allowedReturnPaths, ["/", "/app"]);

    assert.throws(
      () => new InMemoryHumanSessionRepository([{
        providerId: "local-test-provider",
        issuerSha256: sha256Hex("https://issuer.test.invalid"),
        subjectSha256: sha256Hex("opaque-subject"),
        membership: {
          humanSubjectId: UUIDS.subject,
          tenantId: UUIDS.tenant,
          principalId: UUIDS.principal,
          roles: ["integration_client"] as never,
        },
      }]),
      /Invalid human membership seed/
    );
  });
});
