import { expect, test, type Page } from "@playwright/test";

const runtimeErrors = new WeakMap<Page, string[]>();

const apiRequests = (page: Page): string[] => {
  const urls: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) urls.push(request.url());
  });
  return urls;
};

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page) ?? [], "public page emitted browser runtime errors").toEqual([]);
});

test("homepage is responsive, keyboard reachable, and assistant fails closed", async ({ page }, testInfo) => {
  const requests = apiRequests(page);
  await page.goto("/index.html");

  await expect(page).toHaveTitle(/LA Muni RAG/);
  await expect(page.locator("main#contenido")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Consulta pública. Sin caja negra.");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1
  );
  expect(hasHorizontalOverflow).toBe(false);

  const copy = page.locator(".hero-copy-stack");
  const visual = page.locator(".hero-observation-card");
  const [copyBox, visualBox] = await Promise.all([copy.boundingBox(), visual.boundingBox()]);
  expect(copyBox).not.toBeNull();
  expect(visualBox).not.toBeNull();
  if (testInfo.project.name === "chromium-desktop") {
    expect(copyBox!.x + copyBox!.width).toBeLessThanOrEqual(visualBox!.x + 4);
  } else {
    expect(visualBox!.y).toBeGreaterThan(copyBox!.y);
  }

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenido")).toBeFocused();

  await page.getByRole("button", { name: "Asistente" }).first().click();
  const widget = page.locator("#muni-rag-widget");
  await expect(widget.locator(".muni-window")).toHaveClass(/visible/);
  await expect(widget.locator(".muni-header-status")).toHaveText("Servicio no configurado");
  await expect(widget.locator("#muni-input")).toBeDisabled();
  await expect(widget.locator("#muni-send")).toBeDisabled();
  expect(await widget.getAttribute("data-api-configured")).toBe("false");
  expect(requests).toEqual([]);
});

test("reduced-motion mode removes public and widget animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Asistente" }).first().click();

  const styles = await page.evaluate(() => {
    const orb = document.querySelector(".ambient-orb");
    const bubble = document.querySelector("#muni-rag-widget")?.shadowRoot?.querySelector(".muni-bubble");
    if (!(orb instanceof HTMLElement) || !(bubble instanceof HTMLElement)) throw new Error("motion targets missing");
    const orbStyle = getComputedStyle(orb);
    const bubbleStyle = getComputedStyle(bubble);
    return {
      orbAnimation: orbStyle.animationName,
      bubbleAnimation: bubbleStyle.animationName,
      bubbleTransitionMs: Math.max(...bubbleStyle.transitionDuration.split(",").map((value) => {
        const trimmed = value.trim();
        return trimmed.endsWith("ms") ? Number.parseFloat(trimmed) : Number.parseFloat(trimmed) * 1000;
      })),
    };
  });

  expect(styles.orbAnimation).toBe("none");
  expect(styles.bubbleAnimation).toBe("none");
  expect(styles.bubbleTransitionMs).toBeLessThanOrEqual(1);
});

test("Academia degrades safely and stores only bounded learning progress", async ({ page }) => {
  await page.goto("/procedure-training.html");

  await expect(page).toHaveTitle(/Academia de Procedimientos/);
  await expect(page.locator("#training-status")).toHaveAttribute("data-state", "dependency_failure");
  await expect(page.locator("#lesson-list [role=tab]")).toHaveCount(8);
  await expect(page.locator("#lesson-content")).toBeVisible();
  await expect(page.getByText("La API no está disponible", { exact: false })).toBeVisible();

  await page.locator('input[name="knowledge"][value="citation"]').check();
  await page.getByRole("button", { name: "Revisar respuesta" }).click();
  await expect(page.locator("#knowledge-feedback")).toContainText("Correcto");

  await page.getByRole("button", { name: "Marcar como comprendido" }).click();
  const storage = await page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])
  ));
  expect(Object.keys(storage)).toEqual(["la-muni-rag:training-progress:v1"]);
  const serialized = storage["la-muni-rag:training-progress:v1"] ?? "";
  expect(serialized).not.toMatch(/authorization|bearer|token|password|secret|case_context/i);
  expect(JSON.parse(serialized)).toMatchObject({ module_id: "water-community-antigua" });

  await page.reload();
  await expect(page.locator("#training-status")).toHaveAttribute("data-state", "dependency_failure");
  const understoodButton = page.locator("#mark-understood");
  await expect(understoodButton).toHaveText("Comprendido en este navegador");
  await expect(understoodButton).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Borrar progreso local" }).click();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test("procedure workflow remains usable and explicit when Pages has no backend", async ({ page }) => {
  const requests = apiRequests(page);
  await page.goto("/procedure-workflow.html");

  await expect(page).toHaveTitle(/Flujo procedimental/);
  await expect(page.locator("#procedure-empty")).toBeVisible();
  await page.getByRole("button", { name: "Generar flujo" }).click();
  await expect(page.locator("#procedure-error")).toHaveClass(/visible/);
  await expect(page.locator("#procedure-error")).toContainText("El servicio procedimental no está disponible temporalmente.");
  await expect(page.locator("#procedure-error")).not.toContainText("HTTP 503");
  await expect(page.locator("#procedure-runtime-status")).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("button", { name: "Generar flujo" })).toBeEnabled();
  await expect(page.locator("#procedure-workflow")).not.toHaveClass(/visible/);
  expect(requests).toEqual([]);
});

test("configured Pages bridge strips browser credentials and proxies only approved methods", async ({ page, context }) => {
  await context.addCookies([{ name: "session", value: "must-not-leave-browser", url: "http://127.0.0.1:4173" }]);
  await page.goto("/__playwright__/bridge-harness.html");
  await expect(page).toHaveTitle("Pages bridge browser harness");
  expect(await page.evaluate(() => window.__LA_MUNI_API_CONFIG__)).toEqual({
    configured: true,
    baseUrl: "http://127.0.0.1:4173/mock-base/",
  });

  const query = await page.evaluate(async () => {
    const response = await fetch("/api/public/v1/query?source=browser", {
      method: "POST",
      credentials: "include",
      headers: {
        authorization: "Bearer browser-secret",
        "content-type": "application/json",
        "x-custom": "browser-only",
      },
      body: JSON.stringify({ message: "consulta segura", mode: "keyword", limit: 5 }),
    });
    return { status: response.status, body: await response.json() };
  });

  expect(query.status).toBe(200);
  expect(query.body).toMatchObject({
    ok: true,
    method: "POST",
    path: "/api/public/v1/query",
    search: "?source=browser",
    observedHeaders: {
      accept: "application/json",
      authorization: null,
      cookie: null,
      contentType: "application/json",
      xCustom: null,
    },
  });
  expect(JSON.parse(query.body.body)).toEqual({ message: "consulta segura", mode: "keyword", limit: 5 });

  const procedure = await page.evaluate(async () => {
    const response = await fetch("/api/procedure?q=agua&limit=8", {
      headers: { authorization: "Bearer browser-secret", "x-custom": "browser-only" },
      credentials: "include",
    });
    return { status: response.status, body: await response.json() };
  });
  expect(procedure.status).toBe(200);
  expect(procedure.body).toMatchObject({
    method: "GET",
    path: "/api/public/v1/procedure",
    search: "?q=agua&limit=8",
    observedHeaders: { authorization: null, cookie: null, xCustom: null },
  });

  const unsupported = await page.evaluate(async () => {
    const response = await fetch("/api/public/v1/query", { method: "GET" });
    return { status: response.status, body: await response.json() };
  });
  expect(unsupported.status).toBe(200);
  expect(unsupported.body).toMatchObject({
    native: true,
    method: "GET",
    path: "/api/public/v1/query",
  });
  expect(unsupported.body.observedHeaders.cookie).toContain("session=must-not-leave-browser");
});
