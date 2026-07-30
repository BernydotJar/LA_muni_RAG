#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { normalizeBuildSha, sanitizePagesOnlineUrl } from "./pages-build-metadata.mjs";

const baseUrl = sanitizePagesOnlineUrl(process.env.PAGES_ONLINE_URL);
const expectedBuildSha = normalizeBuildSha(process.env.EXPECTED_BUILD_SHA, "EXPECTED_BUILD_SHA");
const waitSeconds = Number(process.env.PAGES_ONLINE_WAIT_SECONDS || "0");
if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > 300) {
  throw new Error("PAGES_ONLINE_WAIT_SECONDS must be an integer between 0 and 300.");
}
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

const scenarios = [
  ["desktop", { viewport: { width: 1440, height: 1000 } }],
  ["mobile", { ...devices["Pixel 7"] }],
];
const results = [];

const readExpectedMetadata = async (request, name) => {
  const deadline = Date.now() + waitSeconds * 1000;
  let lastStatus = null;
  let lastBuildSha = null;
  do {
    const metadataUrl = new URL(`build-metadata.json?verify=${expectedBuildSha}`, baseUrl).href;
    const response = await request.get(metadataUrl, {
      failOnStatusCode: false,
      headers: { "cache-control": "no-cache" },
      timeout: 15_000,
    });
    lastStatus = response.status();
    if (lastStatus === 200) {
      const metadata = await response.json();
      lastBuildSha = metadata?.buildSha ?? null;
      if (lastBuildSha === expectedBuildSha) return metadata;
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  } while (true);
  assert.fail(`${name}: expected build metadata ${expectedBuildSha}; observed HTTP ${lastStatus} and SHA ${lastBuildSha}`);
};

for (const [name, contextOptions] of scenarios) {
  const browser = await chromium.launch({
    headless: true,
    ...(systemChromium ? { executablePath: systemChromium } : {}),
  });
  try {
    const context = await browser.newContext({
      ...contextOptions,
      locale: "es-GT",
      timezoneId: "America/Guatemala",
      colorScheme: "dark",
    });
    const page = await context.newPage();
    const runtimeErrors = [];
    const failedRequests = [];
    const apiRequests = [];
    page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.includes("/api/")) apiRequests.push(request.url());
    });

    const metadata = await readExpectedMetadata(context.request, name);
    const pageUrl = new URL(`index.html?verify=${expectedBuildSha}`, baseUrl).href;
    const response = await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 45_000 });
    assert.equal(response?.status(), 200, `${name}: expected HTTP 200 from ${pageUrl}`);
    assert.deepEqual(
      Object.keys(metadata).sort(),
      ["apiConfigured", "buildSha", "schemaVersion"],
      `${name}: build metadata contains an unexpected field`
    );
    assert.equal(metadata.schemaVersion, "1.0.0", `${name}: unexpected metadata schema`);
    assert.equal(metadata.buildSha, expectedBuildSha, `${name}: deployed artifact SHA mismatch`);
    assert.equal(typeof metadata.apiConfigured, "boolean", `${name}: apiConfigured must be boolean`);

    const state = await page.evaluate(() => {
      const main = document.querySelector("main#contenido");
      const marker = document.querySelector('meta[name="la-muni-rag-build-sha"]');
      const favicon = document.querySelector('link[rel="icon"]');
      const widget = document.querySelector("#muni-rag-widget");
      return {
        title: document.title,
        buildSha: marker?.getAttribute("content") ?? null,
        favicon: favicon?.getAttribute("href") ?? null,
        mainTabIndex: main?.getAttribute("tabindex") ?? null,
        navPresent: Boolean(document.querySelector('nav[aria-label="Navegación principal"]')),
        widgetConfigured: widget?.getAttribute("data-api-configured") ?? null,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    });

    assert.match(state.title, /LA Muni RAG/i, `${name}: unexpected title`);
    assert.equal(state.buildSha, expectedBuildSha, `${name}: HTML SHA marker mismatch`);
    assert.equal(state.favicon, "./favicon.svg", `${name}: favicon is missing`);
    assert.equal(state.mainTabIndex, "-1", `${name}: skip-link target is not focusable`);
    assert.equal(state.navPresent, true, `${name}: product navigation is missing`);
    assert.equal(state.horizontalOverflow, false, `${name}: horizontal overflow detected`);
    assert.equal(state.widgetConfigured, String(metadata.apiConfigured), `${name}: widget/API configuration mismatch`);

    const assistantButton = page.getByRole("button", { name: "Asistente" }).first();
    await assistantButton.click();
    const widget = page.locator("#muni-rag-widget");
    await assert.doesNotReject(async () => widget.locator(".muni-window.visible").waitFor({ state: "visible" }));
    if (!metadata.apiConfigured) {
      assert.equal(await widget.locator("#muni-input").isDisabled(), true, `${name}: fail-closed input is enabled`);
      assert.equal(await widget.locator("#muni-send").isDisabled(), true, `${name}: fail-closed send control is enabled`);
      assert.deepEqual(apiRequests, [], `${name}: unconfigured public page emitted an API request`);
    }

    assert.deepEqual(runtimeErrors, [], `${name}: browser runtime errors detected`);
    assert.deepEqual(failedRequests, [], `${name}: failed network requests detected`);
    results.push({
      name,
      status: "pass",
      buildSha: state.buildSha,
      apiConfigured: metadata.apiConfigured,
      finalUrl: page.url(),
    });
    await context.close();
  } finally {
    await browser.close();
  }
}

process.stdout.write(`${JSON.stringify({
  status: "pass",
  baseUrl,
  expectedBuildSha,
  waitSeconds,
  scenarios: results,
}, null, 2)}\n`);
