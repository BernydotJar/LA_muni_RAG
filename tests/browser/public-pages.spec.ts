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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pregunta sobre documentos municipales. Revisa las fuentes.");

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
  const widgetWindow = widget.locator(".muni-window");
  const widgetBubble = widget.locator("#muni-bubble");
  await expect(widgetWindow).toHaveClass(/visible/);
  await expect(widgetWindow).toHaveAttribute("role", "dialog");
  await expect(widgetWindow).toBeFocused();
  await expect(widgetBubble).toHaveAttribute("aria-expanded", "true");
  await expect(widget.locator(".muni-header-status")).toHaveText("Consulta no disponible");
  await expect(widget.locator("#muni-input")).toBeDisabled();
  await expect(widget.locator("#muni-send")).toBeDisabled();
  expect(await widget.getAttribute("data-api-configured")).toBe("false");
  expect(requests).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(widgetWindow).not.toHaveClass(/visible/);
  await expect(widgetBubble).toHaveAttribute("aria-expanded", "false");
  await expect(widgetBubble).toBeFocused();
});

test("homepage reflows at 320 CSS pixels with usable primary targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/index.html");

  const layout = await page.evaluate(() => {
    const card = document.querySelector(".hero-observation-card");
    const controls = [...document.querySelectorAll(".app-nav a, .app-nav button, .hero-actions .button")];
    if (!(card instanceof HTMLElement)) throw new Error("hero evidence card missing");
    return {
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      cardRight: card.getBoundingClientRect().right,
      cardLeft: card.getBoundingClientRect().left,
      targetHeights: controls.map((control) => control.getBoundingClientRect().height),
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport + 1);
  expect(layout.cardLeft).toBeGreaterThanOrEqual(-1);
  expect(layout.cardRight).toBeLessThanOrEqual(layout.viewport + 1);
  expect(Math.min(...layout.targetHeights)).toBeGreaterThanOrEqual(44);
});


test("assistant fits 320 CSS pixels and reveals sources only on request", async ({ page }) => {
  const requests = apiRequests(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/__playwright__/configured-product.html");

  await page.getByRole("button", { name: "Asistente" }).first().click();
  const widget = page.locator("#muni-rag-widget");
  const widgetWindow = widget.locator(".muni-window");
  await expect(widgetWindow).toHaveClass(/visible/);
  await expect(widget.locator(".muni-header-status")).toHaveText("Listo para buscar en documentos");

  const initialLayout = await widget.evaluate((host) => {
    const shadow = host.shadowRoot;
    const windowEl = shadow?.querySelector(".muni-window");
    const inputArea = shadow?.querySelector(".muni-input-area");
    const input = shadow?.querySelector(".muni-input");
    if (!(windowEl instanceof HTMLElement) || !(inputArea instanceof HTMLElement) || !(input instanceof HTMLElement)) {
      throw new Error("widget layout targets missing");
    }
    const windowBox = windowEl.getBoundingClientRect();
    const inputBox = input.getBoundingClientRect();
    return {
      windowScrollWidth: windowEl.scrollWidth,
      windowClientWidth: windowEl.clientWidth,
      inputAreaScrollWidth: inputArea.scrollWidth,
      inputAreaClientWidth: inputArea.clientWidth,
      windowLeft: windowBox.left,
      windowRight: windowBox.right,
      inputLeft: inputBox.left,
      inputRight: inputBox.right,
      viewport: window.innerWidth,
    };
  });
  expect(initialLayout.windowScrollWidth).toBeLessThanOrEqual(initialLayout.windowClientWidth + 1);
  expect(initialLayout.inputAreaScrollWidth).toBeLessThanOrEqual(initialLayout.inputAreaClientWidth + 1);
  expect(initialLayout.windowLeft).toBeGreaterThanOrEqual(-1);
  expect(initialLayout.windowRight).toBeLessThanOrEqual(initialLayout.viewport + 1);
  expect(initialLayout.inputLeft).toBeGreaterThanOrEqual(initialLayout.windowLeft - 1);
  expect(initialLayout.inputRight).toBeLessThanOrEqual(initialLayout.windowRight + 1);

  await widget.locator("#muni-input").fill("agua potable");
  await widget.locator("#muni-send").click();
  await expect(widget.locator(".muni-answer-title").last()).toContainText(/Respuesta basada en documentos|información relacionada/i);
  const sourceToggle = widget.locator(".muni-evidence-toggle").last();
  const citations = widget.locator(".muni-citations").last();
  await expect(sourceToggle).toHaveText("Ver fuentes");
  await expect(sourceToggle).toHaveAttribute("aria-expanded", "false");
  await expect(citations).toHaveClass(/collapsed/);

  await sourceToggle.click();
  await expect(sourceToggle).toHaveText("Ocultar fuentes");
  await expect(sourceToggle).toHaveAttribute("aria-expanded", "true");
  await expect(citations).not.toHaveClass(/collapsed/);
  expect(await citations.locator(".muni-citation").count()).toBeGreaterThan(0);

  const expandedOverflow = await widget.evaluate((host) => {
    const shadow = host.shadowRoot;
    const windowEl = shadow?.querySelector(".muni-window");
    const messages = shadow?.querySelector(".muni-messages");
    if (!(windowEl instanceof HTMLElement) || !(messages instanceof HTMLElement)) throw new Error("widget overflow targets missing");
    return {
      windowScrollWidth: windowEl.scrollWidth,
      windowClientWidth: windowEl.clientWidth,
      messagesScrollWidth: messages.scrollWidth,
      messagesClientWidth: messages.clientWidth,
    };
  });
  expect(expandedOverflow.windowScrollWidth).toBeLessThanOrEqual(expandedOverflow.windowClientWidth + 1);
  expect(expandedOverflow.messagesScrollWidth).toBeLessThanOrEqual(expandedOverflow.messagesClientWidth + 1);
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
  await expect(page.getByText("El servicio de consulta no está disponible", { exact: false })).toBeVisible();

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

  await expect(page).toHaveTitle(/Guía de procedimientos/);
  await expect(page.locator("#procedure-empty")).toBeVisible();
  await page.getByRole("button", { name: "Revisar procedimiento" }).click();
  await expect(page.locator("#procedure-error")).toHaveClass(/visible/);
  await expect(page.locator("#procedure-error")).toContainText("El servicio procedimental no está disponible temporalmente.");
  await expect(page.locator("#procedure-error")).not.toContainText("HTTP 503");
  await expect(page.locator("#procedure-runtime-status")).toHaveAttribute("data-state", "error");
  await expect(page.getByRole("button", { name: "Revisar procedimiento" })).toBeEnabled();
  await expect(page.locator("#procedure-workflow")).not.toHaveClass(/visible/);
  expect(requests).toEqual([]);
});

test("configured Pages bridge falls back to the frozen public corpus when upstream is unavailable", async ({ page }) => {
  await page.goto("/__playwright__/fallback-harness.html");
  expect(await page.evaluate(() => Boolean(window.__LA_MUNI_PUBLIC_FALLBACK__?.available))).toBe(true);

  const query = await page.evaluate(async () => {
    const response = await fetch("/api/public/v1/query?upstream=unavailable", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "agua potable", mode: "keyword", limit: 3 }),
    });
    return {
      status: response.status,
      fallback: response.headers.get("x-la-muni-rag-static-fallback"),
      body: await response.json(),
    };
  });
  expect(query.status).toBe(200);
  expect(query.fallback).toBe("true");
  expect(query.body.response_type).toBe("public_query");
  expect(query.body.meta).toMatchObject({
    responseLabel: "evidence_found",
    jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  });
  expect(query.body.meta.limitations.join(" ")).toMatch(/proyección pública.*compara palabras y frases|compara palabras y frases.*proyección pública/i);
  expect(query.body.citations.length).toBeGreaterThan(0);
  expect(query.body.citations.every((citation: { sourceUrl?: string; pageStart?: number }) =>
    citation.sourceUrl?.startsWith("https://muniantigua.gob.gt/") && Number.isInteger(citation.pageStart)
  )).toBe(true);

  const domain = await page.evaluate(async () => {
    const response = await fetch("/api/domain-pack?upstream=unavailable", { headers: { accept: "application/json" } });
    return { status: response.status, fallback: response.headers.get("x-la-muni-rag-static-fallback"), body: await response.json() };
  });
  expect(domain.status).toBe(200);
  expect(domain.fallback).toBe("true");
  expect(domain.body).toMatchObject({ id: "municipal-antigua", branding: { productName: "LA Muni RAG" } });

  const procedure = await page.evaluate(async () => {
    const params = new URLSearchParams({
      q: "Qué se necesita para llevar agua potable a una comunidad de Antigua Guatemala",
      mode: "keyword",
      limit: "8",
      depth: "overview",
      upstream: "unavailable",
    });
    const response = await fetch(`/api/procedure?${params}`, { headers: { accept: "application/json" } });
    return { status: response.status, fallback: response.headers.get("x-la-muni-rag-static-fallback"), body: await response.json() };
  });
  expect(procedure.status).toBe(200);
  expect(procedure.fallback).toBe("true");
  expect(procedure.body.steps.length).toBeGreaterThan(0);
  expect(procedure.body.citations.length).toBeGreaterThan(0);
  expect(procedure.body.metadata).toMatchObject({ staticFallback: true, semanticSearch: false, serverAudit: false });
  expect(procedure.body.steps.every((step: { evidenceStatus?: string }) =>
    step.evidenceStatus === "inferred_for_review" || step.evidenceStatus === "missing_evidence"
  )).toBe(true);

  const invalid = await page.evaluate(async () => {
    const response = await fetch("/api/public/v1/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "agua", mode: "keyword", limit: 3, unexpected: true }),
    });
    return { status: response.status, fallback: response.headers.get("x-la-muni-rag-static-fallback"), body: await response.json() };
  });
  expect(invalid.status).toBe(400);
  expect(invalid.fallback).toBe("true");
  expect(invalid.body).toMatchObject({ response_type: "public_error", error: { code: "invalid_request", retryable: false } });
});

test("remote-first Pages bridge preserves meaningful 429 and 500 upstream failures", async ({ page }) => {
  await page.goto("/__playwright__/bridge-harness.html");
  for (const [upstream, expectedStatus, expectedCode] of [
    ["rate-limited", 429, "rate_limited"],
    ["server-error", 500, "upstream_internal_error"],
  ] as const) {
    const result = await page.evaluate(async ({ upstream }) => {
      const response = await fetch(`/api/public/v1/query?upstream=${upstream}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "agua potable", mode: "keyword", limit: 3 }),
      });
      return { status: response.status, fallback: response.headers.get("x-la-muni-rag-static-fallback"), body: await response.json() };
    }, { upstream });
    expect(result.status).toBe(expectedStatus);
    expect(result.fallback).toBeNull();
    expect(result.body).toMatchObject({ error: { code: expectedCode } });
  }
  expect(runtimeErrors.get(page) ?? []).toEqual([
    "console: Failed to load resource: the server responded with a status of 429 (Too Many Requests)",
    "console: Failed to load resource: the server responded with a status of 500 (Internal Server Error)",
  ]);
  runtimeErrors.set(page, []);
});

test("configured Pages bridge strips browser credentials and proxies only approved methods", async ({ page, context, baseURL }) => {
  expect(baseURL).toBeTruthy();
  await context.addCookies([{ name: "session", value: "must-not-leave-browser", url: baseURL! }]);
  await page.goto("/__playwright__/bridge-harness.html");
  await expect(page).toHaveTitle("Pages bridge browser harness");
  expect(await page.evaluate(() => window.__LA_MUNI_API_CONFIG__)).toEqual({
    configured: true,
    baseUrl: new URL("/mock-base/", baseURL).href,
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
