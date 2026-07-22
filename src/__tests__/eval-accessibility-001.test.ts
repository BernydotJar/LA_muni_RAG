import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

const luminance = (hex: string): number => {
  const values = hex.match(/[0-9a-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255) ?? [];
  const linear = values.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
};

const contrast = (foreground: string, background: string): number => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

const token = (css: string, name: string): string => {
  const value = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
  assert.ok(value, `missing ${name}`);
  return value;
};

describe("EVAL-ACCESSIBILITY-001 — procedure training preview", () => {
  it("provides landmarks, names, status announcements and native controls", async () => {
    const html = await read("public/procedure-training.html");

    assert.match(html, /<header[^>]*class="academy-topbar"/);
    assert.match(html, /<nav[^>]+aria-label=/);
    assert.match(html, /<main id="training-main"/);
    assert.match(html, /<aside[^>]+aria-label="Panel de evidencia/);
    assert.match(html, /id="lesson-content"[^>]+role="tabpanel"/);
    assert.match(html, /role="status"[^>]+aria-live="polite"/);
    assert.match(html, /<label[^>]+for="training-module"/);
    assert.match(html, /<select id="training-module"/);
    assert.match(html, /<fieldset[^>]*>/);
    assert.match(html, /<legend>/);
    assert.match(html, /<button[^>]+id="mark-understood"/);
  });

  it("supports visible focus, reduced motion, forced colors and responsive reflow", async () => {
    const css = await read("public/procedure-training.css");

    assert.match(css, /:focus-visible/);
    assert.match(css, /outline:\s*3px solid var\(--focus\)/);
    assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
    assert.match(css, /animation-duration:\s*0\.01ms/);
    assert.match(css, /@media \(forced-colors:\s*active\)/);
    assert.match(css, /@media \(max-width:\s*1120px\)/);
    assert.match(css, /@media \(max-width:\s*760px\)/);
    assert.match(css, /min-height:\s*44px/);
  });

  it("meets AA contrast for core text and status pairs", async () => {
    const css = await read("public/procedure-training.css");
    const background = token(css, "--surface-0");
    const raised = token(css, "--surface-2");
    const text = token(css, "--text-primary");
    const muted = token(css, "--text-secondary");
    const accentInk = token(css, "--accent-ink");
    const accent = token(css, "--accent");

    assert.ok(contrast(text, background) >= 7, "primary text needs enhanced contrast");
    assert.ok(contrast(muted, background) >= 4.5, "secondary text needs AA contrast");
    assert.ok(contrast(text, raised) >= 4.5, "raised-surface text needs AA contrast");
    assert.ok(contrast(accentInk, accent) >= 4.5, "accent button pair needs AA contrast");
  });

  it("supports roving lesson keyboard navigation and focus management", async () => {
    const script = await read("public/procedure-training.js");

    assert.match(script, /\["ArrowDown", "ArrowUp", "Home", "End"\]/);
    assert.match(script, /event\.key === "ArrowDown"/);
    assert.match(script, /event\.key === "ArrowUp"/);
    assert.match(script, /event\.key === "Home"/);
    assert.match(script, /event\.key === "End"/);
    assert.match(script, /elements\.lessonList\.querySelectorAll\("\.lesson-tab"\)\[nextIndex\]\?\.focus\(\)/);
    assert.match(script, /aria-current/);
    assert.match(script, /aria-selected/);
    assert.match(script, /`lesson-tab-\$\{lesson\.id\} lesson-title`/);
  });

  it("documents the limits of automated accessibility evidence", async () => {
    const evaluation = await read("docs/testing/eval-harness.md");
    const spec = await read("specs/063-procedure-training-console/spec.md");

    assert.match(evaluation, /## EVAL-ACCESSIBILITY-001/);
    assert.match(evaluation, /static training surface/);
    assert.match(evaluation, /screen-reader/);
    assert.match(spec, /human WCAG review/);
    assert.match(spec, /not the authenticated SaaS\s+application/);
  });
});
