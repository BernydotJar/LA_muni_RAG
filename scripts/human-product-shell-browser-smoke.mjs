#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { chromium, firefox, webkit } from "@playwright/test";
import {
  DeterministicHumanIdentityProvider,
  DeterministicTestSecretProtector,
  InMemoryHumanSessionRepository,
  sha256Hex,
} from "../dist/humanSession/index.js";
import { createApiServer } from "../dist/server.js";

const ISSUER = "https://issuer.shell.test.invalid";
const TENANT = "11111111-1111-4111-8111-111111111111";
const VIEWER_PRINCIPAL = "22222222-2222-4222-8222-222222222222";
const ADMIN_PRINCIPAL = "33333333-3333-4333-8333-333333333333";
const VIEWER_SUBJECT_ID = "44444444-4444-4444-8444-444444444444";
const ADMIN_SUBJECT_ID = "55555555-5555-4555-8555-555555555555";
const VIEWER_SUBJECT = "human-shell-viewer";
const ADMIN_SUBJECT = "human-shell-tenant-admin";

const reservePort = async () => {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
};

const port = await reservePort();
const origin = `http://127.0.0.1:${port}`;
const provider = new DeterministicHumanIdentityProvider();
const repository = new InMemoryHumanSessionRepository([
  {
    providerId: provider.providerId,
    issuerSha256: sha256Hex(ISSUER),
    subjectSha256: sha256Hex(VIEWER_SUBJECT),
    membership: {
      humanSubjectId: VIEWER_SUBJECT_ID,
      tenantId: TENANT,
      principalId: VIEWER_PRINCIPAL,
      roles: ["viewer"],
    },
  },
  {
    providerId: provider.providerId,
    issuerSha256: sha256Hex(ISSUER),
    subjectSha256: sha256Hex(ADMIN_SUBJECT),
    membership: {
      humanSubjectId: ADMIN_SUBJECT_ID,
      tenantId: TENANT,
      principalId: ADMIN_PRINCIPAL,
      roles: ["tenant_admin"],
    },
  },
]);
const server = createApiServer({
  legacyApiEnabled: false,
  humanSession: {
    enabled: true,
    approvedProvider: true,
    provider,
    repository,
    protector: new DeterministicTestSecretProtector({ allowInsecureTestOnly: true }),
    publicOrigin: origin,
  },
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});

const browserName = process.env.HUMAN_SHELL_BROWSER ?? "chromium";
const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName];
if (!browserType) throw new Error(`Unsupported HUMAN_SHELL_BROWSER: ${browserName}`);
const explicitExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const executablePath = browserName === "chromium"
  ? explicitExecutable || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined)
  : undefined;
const browser = await browserType.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

const assertAccessibleShell = async (page, options) => {
  const expectedAuthenticated = options.state === "authenticated";
  assert.equal(await page.locator("html").getAttribute("lang"), "es");
  assert.match(await page.title(), /LA Muni RAG/);
  assert.equal(await page.getByRole("main").count(), 1);
  assert.equal(
    await page.getByRole("navigation", { name: "Navegación del producto" }).count(),
    expectedAuthenticated ? 1 : 0
  );
  assert.equal(await page.getByRole("link", { name: "Saltar al espacio de trabajo" }).count(), 1);

  const audit = await page.evaluate(() => {
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      return !element.hidden && style.display !== "none" && style.visibility !== "hidden" &&
        Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    };
    const accessibleName = (element) => {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const value = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || "").join(" ").trim();
        if (value) return value;
      }
      if (element instanceof HTMLImageElement && element.alt.trim()) return element.alt.trim();
      const title = element.getAttribute("title")?.trim();
      if (title) return title;
      return element.textContent?.replace(/\s+/g, " ").trim() || "";
    };
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const interactive = [...document.querySelectorAll("a[href], button, input, select, textarea, [role=button], [tabindex]")]
      .filter((element) => visible(element) && element.getAttribute("tabindex") !== "-1");
    const unnamedInteractive = interactive
      .filter((element) => accessibleName(element).length === 0)
      .map((element) => element.id || element.tagName.toLowerCase());
    const undersizedTargets = interactive
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => !element.classList.contains("skip-link") && (rect.width < 24 || rect.height < 24))
      .map(({ element, rect }) => ({ id: element.id || element.tagName.toLowerCase(), width: rect.width, height: rect.height }));
    const headingLevels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((heading) => Number(heading.tagName.slice(1)));
    const headingJumps = headingLevels.filter((level, index) => index > 0 && level > headingLevels[index - 1] + 1);
    const hiddenFocusableVisible = [...document.querySelectorAll("[hidden] a[href], [hidden] button, [hidden] input, [hidden] select, [hidden] textarea, [hidden] [tabindex]")]
      .filter(visible)
      .length;
    return {
      duplicateIds,
      unnamedInteractive,
      undersizedTargets,
      headingLevels,
      headingJumps,
      hiddenFocusableVisible,
      currentPageCount: [...document.querySelectorAll('[aria-current="page"]')].filter(visible).length,
      liveRegionCount: document.querySelectorAll('[aria-live="polite"], [role="status"]').length,
    };
  });
  assert.deepEqual(audit.duplicateIds, []);
  assert.deepEqual(audit.unnamedInteractive, []);
  assert.deepEqual(audit.undersizedTargets, []);
  assert.deepEqual(audit.headingJumps, []);
  assert.equal(audit.hiddenFocusableVisible, 0);
  assert.ok(audit.liveRegionCount >= 2);
  assert.equal(audit.currentPageCount, expectedAuthenticated ? 1 : 0);

  const originalViewport = page.viewportSize() || { width: 1280, height: 720 };
  await page.setViewportSize({ width: 320, height: 900 });
  const previousRootOverflowY = await page.evaluate(() => {
    const previous = document.documentElement.style.overflowY;
    document.documentElement.style.overflowY = "scroll";
    return previous;
  });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const reflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const overflowElements = [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > viewportWidth + 1 || rect.left < -1;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || "",
        className: typeof element.className === "string" ? element.className : "",
        right: Math.round(element.getBoundingClientRect().right),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }));
    return {
      overflow: document.documentElement.scrollWidth - viewportWidth,
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      rootMinWidth: getComputedStyle(document.documentElement).minWidth,
      overflowElements,
    };
  });
  assert.ok(
    reflow.overflow <= 1,
    `document overflowed narrow viewport: ${JSON.stringify(reflow)}`
  );
  await page.evaluate((previous) => {
    document.documentElement.style.overflowY = previous;
  }, previousRootOverflowY);
  await page.setViewportSize(originalViewport);

  if (expectedAuthenticated) {
    assert.equal(await page.getByRole("heading", { name: "Espacio municipal", level: 1 }).count(), 1);
    assert.equal(await page.getByRole("button", { name: "Cerrar sesión" }).count(), 1);
    for (const route of options.visibleRoutes) {
      const button = page.locator(`[data-route="${route}"]`);
      assert.equal(await button.isVisible(), true);
      assert.ok((await button.textContent())?.trim());
    }
  } else {
    assert.equal(await page.getByRole("heading", { name: "Inicia sesión para continuar.", level: 1 }).count(), 1);
    assert.equal(await page.getByRole("link", { name: "Iniciar sesión" }).count(), 1);
  }
};

const runRole = async ({ subject, expectedRole, visible, hidden }) => {
  const context = await browser.newContext({
    locale: "es-GT",
    timezoneId: "America/Guatemala",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const authResponses = [];
  const failedLocalResponses = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      consoleErrors.push({ text: message.text(), url: location.url || "" });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === origin && url.pathname.startsWith("/auth/")) {
      authResponses.push({ path: url.pathname, status: response.status() });
    }
    if (response.status() >= 400) {
      failedResponses.push({ origin: url.origin, path: url.pathname, status: response.status() });
    }
    if (url.origin === origin && response.status() >= 400) {
      failedLocalResponses.push({ path: url.pathname, status: response.status() });
    }
  });



  await page.goto(`${origin}/app/search`, { waitUntil: "domcontentloaded" });
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForFunction(() => document.body.dataset.shellState === "unauthenticated");
  assert.equal(await page.locator("#sign-in").isVisible(), true);
  assert.equal(await page.locator("#authenticated-workspace").isVisible(), false);
  await assertAccessibleShell(page, { state: "unauthenticated", visibleRoutes: [] });
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".skip-link").evaluate((element) => element === document.activeElement), true);

  const signInHref = await page.locator("#sign-in").getAttribute("href");
  assert.equal(signInHref, "/auth/login?return_to=%2Fapp%2Fsearch");
  const loginResponse = await context.request.get(`${origin}${signInHref}`, {
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  assert.equal(loginResponse.status(), 302);
  const authorizationLocation = loginResponse.headers().location;
  assert.ok(authorizationLocation);
  const authorizationUrl = new URL(authorizationLocation);
  assert.equal(authorizationUrl.origin, "https://test-idp.invalid");
  assert.equal(authorizationUrl.pathname, "/authorize");
  const state = authorizationUrl.searchParams.get("state");
  assert.ok(state);
  assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorizationUrl.searchParams.get("redirect_uri"), `${origin}/auth/callback`);
  const loginCookie = (await context.cookies(origin)).find((cookie) => cookie.name === "la_muni_login");
  assert.ok(loginCookie?.httpOnly);
  assert.equal(loginCookie.sameSite, "Lax");
  const code = provider.issueAuthorizationCode(state, { issuer: ISSUER, subject });
  const callbackUrl = `${origin}/auth/callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`;
  await page.goto(callbackUrl, { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(() => document.body.dataset.shellState === "authenticated");
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      path: location.pathname,
      shellState: document.body.dataset.shellState || "missing",
      errorCode: document.querySelector("#shell-error-message")?.textContent || "",
    }));
    throw new Error(`Shell authentication did not complete: ${JSON.stringify({
      browser: browserName,
      ...diagnostic,
      authResponses,
      consoleErrors,
      pageErrors,
    })}`, { cause: error });
  }
  assert.equal(new URL(page.url()).pathname, "/app/search");
  assert.equal(await page.locator('[data-panel="evidence"]').isVisible(), true);
  assert.equal(await page.locator("#role-list").textContent(), expectedRole.replaceAll("_", " "));
  assert.equal(await page.locator("#tenant-id").textContent(), TENANT);
  assert.match(await page.locator("#principal-id").textContent(), /^[0-9a-f-]{36}$/);

  for (const route of visible) {
    assert.equal(await page.locator(`[data-route="${route}"]`).isVisible(), true, `${route} should be visible`);
  }
  for (const route of hidden) {
    assert.equal(await page.locator(`[data-route="${route}"]`).isVisible(), false, `${route} should be hidden`);
  }
  await assertAccessibleShell(page, { state: "authenticated", visibleRoutes: visible });
  await page.locator('[data-route="overview"]').click();
  await page.waitForFunction(() => location.pathname === "/app");
  assert.equal(await page.locator('[data-panel="overview"]').isVisible(), true);

  if (process.env.HUMAN_SHELL_SCREENSHOT_PATH && expectedRole === "tenant_admin") {
    await page.screenshot({
      path: process.env.HUMAN_SHELL_SCREENSHOT_PATH,
      type: "jpeg",
      quality: 72,
      fullPage: false,
    });
  }

  const primaryAction = page.locator('[data-action-route="evidence"]');
  assert.equal(await primaryAction.isVisible(), true);
  await primaryAction.click();
  await page.waitForFunction(() => location.pathname === "/app/search");
  assert.equal(await page.locator('[data-panel="evidence"]').isVisible(), true);
  await page.locator('[data-route="overview"]').click();
  await page.waitForFunction(() => location.pathname === "/app");
  assert.equal(await page.locator('[data-panel="overview"]').isVisible(), true);
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/app/search");
  assert.equal(await page.locator('[data-panel="evidence"]').isVisible(), true);
  await page.goForward();
  await page.waitForFunction(() => location.pathname === "/app");
  assert.equal(await page.locator('[data-panel="overview"]').isVisible(), true);

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    exposedCookie: document.cookie,
    body: document.body.textContent || "",
  }));
  assert.deepEqual({ local: storage.local, session: storage.session, exposedCookie: storage.exposedCookie }, {
    local: 0,
    session: 0,
    exposedCookie: "",
  });
  assert.doesNotMatch(storage.body, /[A-Za-z0-9_-]{43,172}/);

  const beforeCookies = await context.cookies(origin);
  const beforeSession = beforeCookies.find((cookie) => cookie.name === "la_muni_session");
  assert.ok(beforeSession?.httpOnly);
  assert.equal(beforeSession.sameSite, "Lax");
  const beforeGeneration = Number(await page.locator("#session-generation").textContent());
  await page.locator("#rotate-session").click();
  await page.waitForFunction((generation) =>
    Number(document.getElementById("session-generation")?.textContent) === generation + 1,
    beforeGeneration
  );
  const afterCookies = await context.cookies(origin);
  const afterSession = afterCookies.find((cookie) => cookie.name === "la_muni_session");
  assert.ok(afterSession?.httpOnly);
  assert.notEqual(afterSession.value, beforeSession.value);
  assert.equal(await page.locator("#shell-alert").isVisible(), true);

  if (visible.includes("identity")) {
    await page.locator('[data-route="identity"]').click();
    await page.waitForFunction(() => location.pathname === "/app/admin/identity");
    assert.equal(await page.locator('[data-panel="identity"]').isVisible(), true);
  } else {
    await page.evaluate(() => {
      history.pushState(null, "", "/app/admin/identity");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForFunction(() => location.pathname === "/app");
    assert.equal(await page.locator('[data-panel="identity"]').isVisible(), false);
    await page.evaluate(() => { location.hash = "identity"; });
    await page.waitForFunction(() => location.hash === "#overview");
    assert.equal(await page.locator('[data-panel="identity"]').isVisible(), false);
    await page.evaluate(() => { location.hash = '%22%5D%2C%20%5Bdata-route%5D'; });
    await page.waitForFunction(() => location.hash === "#overview");
    assert.equal(await page.locator('[data-panel="overview"]').isVisible(), true);
  }

  await page.locator("#logout").click();
  await page.waitForFunction(() => document.body.dataset.shellState === "unauthenticated");
  assert.equal(await page.locator("#authenticated-workspace").isVisible(), false);
  assert.equal((await context.cookies(origin)).some((cookie) => cookie.name === "la_muni_session"), false);
  const unexpectedConsoleErrors = consoleErrors.filter((message) =>
    !message.text.includes("Failed to load resource: the server responded with a status of 401")
  );
  assert.deepEqual(unexpectedConsoleErrors, [], JSON.stringify({
    browser: browserName,
    failedLocalResponses,
    failedResponses,
  }));
  assert.deepEqual(pageErrors, []);
  await context.close();
};

try {
  await runRole({
    subject: VIEWER_SUBJECT,
    expectedRole: "viewer",
    visible: ["overview", "evidence", "procedures", "cases", "sources", "documents"],
    hidden: ["ingestion", "authoring", "review", "approval", "identity", "audit", "platform"],
  });
  await runRole({
    subject: ADMIN_SUBJECT,
    expectedRole: "tenant_admin",
    visible: ["overview", "evidence", "procedures", "cases", "sources", "documents", "ingestion", "authoring", "review", "identity", "audit"],
    hidden: ["approval", "platform"],
  });
  console.log(JSON.stringify({
    status: "human_product_shell_browser_smoke_passed",
    browser: browserName,
    provider: "deterministic_test_only",
    roles: ["viewer", "tenant_admin"],
    role_aware_navigation: true,
    session_rotation: true,
    logout_revocation: true,
    web_storage_credentials: false,
    document_cookie_exposure: false,
    automated_accessibility_checks: true,
    canonical_deep_links: true,
    task_first_workspace: true,
    narrow_viewport: 320,
    minimum_target_px: 24,
    productive_authenticated_journeys: "0/12",
  }));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
