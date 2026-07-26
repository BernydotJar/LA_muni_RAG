import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const launchOptions = systemChromium ? { executablePath: systemChromium } : {};

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "dark",
    locale: "es-GT",
    timezoneId: "America/Guatemala",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        launchOptions,
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions,
      },
    },
  ],
  webServer: {
    command: "npm run browser:serve",
    url: "http://127.0.0.1:4173/__playwright__/health",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
